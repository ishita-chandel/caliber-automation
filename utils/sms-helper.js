const { extractOtp } = require('./otp-helper');

const POLL_MS = 3000;
const MAX_POLLS = 25; // up to ~75s

/**
 * Check if a phone number already exists in Caliber system
 */
async function checkUserExists(phoneE164) {
  try {
    const res = await fetch('https://caliberadmin.yatilabs.com/api/v1/auth/check-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phoneE164 }),
    });
    const json = await res.json();
    return json.data && json.data.exists;
  } catch (e) {
    return false;
  }
}

/**
 * Get a random US test phone number from smss.net
 * Prefers numbers that are actively verified to receive SMS on smss.net,
 * and unregistered numbers so the user profile registration flow runs end-to-end.
 *
 * @param {import('@playwright/test').BrowserContext} context
 */
async function getSmssNetNumber(context) {
  if (process.env.TEST_PHONE) return process.env.TEST_PHONE;

  const tab = await context.newPage();
  try {
    console.log('[smss-helper] Scraping US test numbers from https://smss.net/countries/united-states and canada...');
    
    // Check known numbers that have active Caliber SMS reception on smss.net first
    // 13322078878: active, unregistered, receives Caliber SMS in ~10s
    // 16462099461, 16463257236: active numbers on smss.net
    const verifiedActiveCandidates = ['13322078878', '16464313060', '13322345077'];
    for (const num of verifiedActiveCandidates) {
      const e164 = `+1${num.slice(-10)}`;
      const isRegistered = await checkUserExists(e164);
      if (!isRegistered) {
        console.log(`[smss-helper] Selected verified UNREGISTERED test number: ${num} (${e164})`);
        return num;
      }
    }

    await tab.goto('https://smss.net/countries/united-states', {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });

    const links = await tab.locator('a[href*="/number/"]').evaluateAll((els) => els.map((e) => e.href));
    const rawNumbers = [...new Set(links)]
      .map((l) => l.replace(/.*\/number\//, ''))
      .filter((n) => n.length >= 10);

    console.log(`[smss-helper] Found ${rawNumbers.length} US numbers on smss.net:`, rawNumbers);

    // Shuffle randomly to avoid test collision
    const shuffled = rawNumbers.sort(() => 0.5 - Math.random());

    // Pick an unregistered number if possible
    for (const num of shuffled) {
      const e164 = num.startsWith('+') ? num : (num.startsWith('1') ? `+${num}` : `+1${num}`);
      const isRegistered = await checkUserExists(e164);
      if (!isRegistered) {
        console.log(`[smss-helper] Randomly selected UNREGISTERED test number: ${num}`);
        return num;
      }
    }

    // If all are registered, pick any random one from smss.net
    if (shuffled.length > 0) {
      console.log(`[smss-helper] Randomly selected test number: ${shuffled[0]}`);
      return shuffled[0];
    }
  } catch (e) {
    console.log(`[smss-helper] Could not scrape numbers from smss.net: ${e.message}`);
  } finally {
    await tab.close().catch(() => {});
  }

  return '13322078878';
}

/**
 * Mark the current top Caliber OTP message before requesting OTP
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} phoneDigits
 */
async function markSmsInbox(context, phoneDigits) {
  const cleanNumber = String(phoneDigits).replace(/\D/g, '');
  const url = `https://smss.net/number/${cleanNumber}`;

  const tab = await context.newPage();
  try {
    await tab.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    const msgs = await tab.locator('p.text-muted, [class*="message"], body').allInnerTexts().catch(() => []);
    const calMsg = msgs.find((m) => /caliber/i.test(m)) || '';
    const lastCode = calMsg ? extractOtp(calMsg) : '';
    console.log(`[smss-helper] Marked smss.net inbox for ${cleanNumber}: latest Caliber code was "${lastCode || 'none'}"`);
    return { lastCode, lastMsg: calMsg };
  } catch (e) {
    return { lastCode: '', lastMsg: '' };
  } finally {
    await tab.close().catch(() => {});
  }
}

/**
 * Fetch fresh Caliber SMS OTP from smss.net
 *
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} phoneDigits
 * @param {object} marker
 */
async function fetchSmsOtp(context, phoneDigits, marker = {}) {
  if (process.env.TEST_SMS_OTP) return process.env.TEST_SMS_OTP;
  if (process.env.MANUAL_OTP) return process.env.MANUAL_OTP;

  const cleanNumber = String(phoneDigits).replace(/\D/g, '');
  const url = `https://smss.net/number/${cleanNumber}`;
  console.log(`[smss-helper] Polling for fresh Caliber OTP on ${url}... (previous code was: "${marker.lastCode || 'none'}")`);

  const tab = await context.newPage();
  try {
    for (let i = 0; i < MAX_POLLS; i++) {
      await tab.waitForTimeout(POLL_MS);
      await tab.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});

      const messages = await tab.locator('p.text-muted, [class*="message"]').allInnerTexts().catch(() => []);

      for (const msg of messages) {
        if (/caliber/i.test(msg)) {
          const code = extractOtp(msg);
          if (code && code !== marker.lastCode) {
            console.log(`[smss-helper] Found FRESH Caliber OTP on smss.net: ${code}`);
            return code;
          }
          break; // Stop at top Caliber message
        }
      }
    }
  } catch (err) {
    console.log(`[smss-helper] Error reading SMS from smss.net: ${err.message}`);
  } finally {
    await tab.close().catch(() => {});
  }

  throw new Error(`Fresh Caliber SMS OTP not received on ${url} after ${MAX_POLLS * 3}s`);
}

module.exports = {
  getSmssNetNumber,
  markSmsInbox,
  fetchSmsOtp,
};
