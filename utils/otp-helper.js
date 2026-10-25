const cfg = require('./config');
const { providerOf } = require('./data-factory');

/**
 * OTP handling for Mailinator, Yopmail and Gmail.
 *
 * Usage (always in this order, otherwise an OLD otp from the same inbox can be read):
 *   const marker = await markInbox(context, email);   // remember what is in the inbox now
 *   ...click "Send OTP" in the app...
 *   const otp = await fetchOtp(context, email, marker); // wait for a NEW mail, read the code
 *
 * Mailinator / Yopmail are read in a separate browser tab (the app tab is never touched).
 * Gmail is read over IMAP (Google blocks UI scraping), using GMAIL_USER + GMAIL_APP_PASSWORD.
 */

const POLL_MS = 4000;
const MAX_POLLS = 20; // ~100 seconds

// ---------------------------------------------------------------- public API
async function markInbox(context, email) {
  const provider = providerOf(email);
  if (provider === 'mailinator') return withTab(context, (p) => mailinatorMarker(p, email));
  if (provider === 'yopmail') return withTab(context, (p) => yopmailMarker(p, email));
  return gmailMarker();
}

async function fetchOtp(context, email, marker) {
  if (process.env.MANUAL_OTP) return process.env.MANUAL_OTP; // escape hatch: MANUAL_OTP=123456 npm start
  const provider = providerOf(email);
  if (provider === 'mailinator') return withTab(context, (p) => mailinatorRead(p, email, marker));
  if (provider === 'yopmail') return withTab(context, (p) => yopmailRead(p, email, marker));
  return gmailRead(email, marker);
}

// ---------------------------------------------------------------- shared
async function withTab(context, fn) {
  const tab = await context.newPage();
  try {
    return await fn(tab);
  } finally {
    await tab.close().catch(() => {});
  }
}

function extractOtp(text) {
  // 1) number right after words like "code" / "otp" / "passcode" / "password" / "verification"
  const labelled = text.match(/(?:code|otp|passcode|password|verification)[^\d]{0,40}(\d{4,8})\b/i);
  if (labelled) return labelled[1];
  // 2) any 4-8 digit number, but skip years (19xx, 20xx)
  const candidates = [...text.matchAll(/\b(\d{4,8})\b/g)].map((m) => m[1]).filter((n) => !/^(19|20)\d{2}$/.test(n));
  if (candidates.length) return candidates[0];
  throw new Error(`OTP not found in mail body:\n${text.slice(0, 500)}`);
}

// ---------------------------------------------------------------- Mailinator
const MAILINATOR_CALIBER_ROW = 'tr:has-text("Caliber Card"), tr:has-text("CaliberCard")';

async function openMailinator(page, email) {
  const inbox = email.split('@')[0];
  await page.goto(`https://www.mailinator.com/v4/public/inboxes.jsp?to=${inbox}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
}

async function mailinatorFirstRowId(page) {
  const row = page.locator(MAILINATOR_CALIBER_ROW).first();
  if (!(await row.isVisible().catch(() => false))) return null;
  return (await row.getAttribute('id').catch(() => null)) || (await row.innerText().catch(() => null));
}

async function mailinatorMarker(page, email) {
  await openMailinator(page, email);
  return { rowId: await mailinatorFirstRowId(page) };
}

async function mailinatorRead(page, email, marker) {
  await openMailinator(page, email);

  for (let i = 0; i < MAX_POLLS; i++) {
    const current = await mailinatorFirstRowId(page);
    // If a new email appears that differs from the marker
    if (current && current !== (marker && marker.rowId)) {
      break;
    }
    if (i === MAX_POLLS - 1) {
      // If no different row ID, but a Caliber row exists, proceed to read it
      if (current) break;
      throw new Error(`No new Mailinator mail for ${email} after ${(MAX_POLLS * POLL_MS) / 1000}s`);
    }
    await page.waitForTimeout(POLL_MS);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
  }

  const row = page.locator(MAILINATOR_CALIBER_ROW).first();
  await row.waitFor({ state: 'visible', timeout: 15000 });
  await row.click();
  await page.waitForTimeout(2000);

  const frame = page.frameLocator('#html_msg_body');
  await frame.locator('body').waitFor({ state: 'visible', timeout: 15000 });
  let text = await frame.locator('body').innerText({ timeout: 15000 }).catch(() => '');
  if (!text) {
    const rawFrame = page.frame({ name: 'html_msg_body' });
    if (rawFrame) {
      text = await rawFrame.locator('body').innerText({ timeout: 15000 }).catch(() => '');
    }
  }
  return extractOtp(text);
}

// ---------------------------------------------------------------- Yopmail

/**
 * Reads the ifinbox frame HTML directly (bypasses element-visibility checks
 * that may be affected by Cloudflare bot detection) and returns the first
 * mail identifier found in it, or null when the inbox is empty.
 */
async function yopmailFirstIdFromHtml(page) {
  try {
    // Try via named frame reference first (avoids frameLocator visibility issues)
    const ifinboxFrame = page.frame({ name: 'ifinbox' });
    if (ifinboxFrame) {
      const html = await ifinboxFrame.content();
      // Yopmail inbox items have id="m..." or data-id="..." on div.m elements
      const idMatch = html.match(/<div[^>]+class="[^"]*\bm\b[^"]*"[^>]*id="([^"]+)"/);
      if (idMatch) return idMatch[1];
      // Also look for subject text as a stable identifier
      const subjectMatch = html.match(/<span class="subject">([^<]+)<\/span>/);
      if (subjectMatch) return subjectMatch[1].trim();
      // Return null only if the HTML has no mail divs at all
      if (!html.includes('div class="m"') && !html.includes('class="lm"')) return null;
    }
  } catch { /* fall through to frameLocator */ }

  // Fallback: frameLocator-based check
  const first = page.frameLocator('#ifinbox').locator('div.m').first();
  if (await first.isVisible({ timeout: 2000 }).catch(() => false)) {
    return (await first.getAttribute('id').catch(() => null))
      || (await first.innerText().catch(() => null));
  }
  return null;
}

async function openYopmail(page, email) {
  const inbox = email.split('@')[0];
  // Use /en/wm (webmail) — keeps session cookies across tabs in the same context
  await page.goto('https://yopmail.com/en/wm', { waitUntil: 'domcontentloaded' });
  const consent = page.getByRole('button', { name: /accept|agree|consent|ok/i }).first();
  if (await consent.isVisible({ timeout: 3000 }).catch(() => false)) await consent.click().catch(() => {});

  // If the login input is visible, submit the inbox name.
  // If hidden, the page already loaded directly into inbox state (session cookie reuse).
  const loginInput = page.locator('#login');
  const loginType = await loginInput.getAttribute('type').catch(() => null);
  const loginVisible = loginType !== 'hidden'
    && await loginInput.isVisible({ timeout: 4000 }).catch(() => false);

  if (loginVisible) {
    await loginInput.fill(inbox);
    await loginInput.press('Enter');
  }
  // else: already in inbox — no action needed, the iframe will load for the right inbox

  // Wait for the inbox iframe to attach
  await page.locator('#ifinbox').waitFor({ state: 'attached', timeout: 25000 });
  await page.waitForTimeout(1500); // let iframe JS finish initial render
}

async function yopmailMarker(page, email) {
  await openYopmail(page, email);
  await page.waitForTimeout(500);
  return { rowId: await yopmailFirstIdFromHtml(page) };
}

async function yopmailRead(page, email, marker) {
  await openYopmail(page, email);

  for (let i = 0; i < MAX_POLLS; i++) {
    const current = await yopmailFirstIdFromHtml(page);
    if (current && current !== (marker && marker.rowId)) break;
    if (i === MAX_POLLS - 1) {
      throw new Error(
        `No new Yopmail mail for ${email} after ${(MAX_POLLS * POLL_MS) / 1000}s. ` +
        `Inbox marker was: ${marker && marker.rowId}. ` +
        `If the OTP email is not arriving check Caliber Card's email delivery to yopmail.com.`,
      );
    }
    await page.waitForTimeout(POLL_MS);
    // Refresh the inbox (the refresh button is in the parent /wm page)
    await page.locator('#refresh, #refreshbut, button:has-text("Refresh")').first().click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // Click the first mail — try frame object then frameLocator
  const ifinboxFrame = page.frame({ name: 'ifinbox' });
  if (ifinboxFrame) {
    const firstMail = ifinboxFrame.locator('div.m, .lm, [class*="mail-item"]').first();
    if (await firstMail.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstMail.click();
    } else {
      // Fallback: click by evaluating JS inside the frame
      await ifinboxFrame.evaluate(() => {
        const first = document.querySelector('div.m');
        if (first) first.click();
      });
    }
  } else {
    await page.frameLocator('#ifinbox').locator('div.m').first().click();
  }

  await page.waitForTimeout(1000);

  // Read mail body — try frame object then frameLocator
  let text = '';
  const ifmailFrame = page.frame({ name: 'ifmail' });
  if (ifmailFrame) {
    text = await ifmailFrame.locator('#mail').innerText({ timeout: 15000 }).catch(() => '');
    if (!text) text = await ifmailFrame.evaluate(() => document.querySelector('#mail')?.innerText || document.body?.innerText || '');
  }
  if (!text) {
    text = await page.frameLocator('#ifmail').locator('#mail').innerText({ timeout: 15000 }).catch(() => '');
  }
  if (!text) throw new Error('Yopmail: mail body empty after clicking first message');
  return extractOtp(text);
}

// ---------------------------------------------------------------- Gmail (IMAP)
function lazyImap() {
  // required lazily so Mailinator / Yopmail runs never need these packages to load
  const { ImapFlow } = require('imapflow');
  const { simpleParser } = require('mailparser');
  return { ImapFlow, simpleParser };
}

async function withImap(fn) {
  if (!cfg.GMAIL_USER || !cfg.GMAIL_APP_PASSWORD) {
    throw new Error('Gmail OTP needs GMAIL_USER and GMAIL_APP_PASSWORD in .env (Google App Password, IMAP enabled)');
  }
  const { ImapFlow } = lazyImap();
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: cfg.GMAIL_USER, pass: cfg.GMAIL_APP_PASSWORD },
    logger: false,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.logout().catch(() => {});
  }
}

async function gmailMaxUid(client) {
  const lock = await client.getMailboxLock('INBOX');
  try {
    const uids = await client.search({ all: true }, { uid: true });
    return uids.length ? Math.max(...uids) : 0;
  } finally {
    lock.release();
  }
}

async function gmailMarker() {
  return withImap(async (client) => ({ uid: await gmailMaxUid(client) }));
}

async function gmailRead(email, marker) {
  const { simpleParser } = lazyImap();
  const lastUid = (marker && marker.uid) || 0;
  for (let i = 0; i < MAX_POLLS; i++) {
    const text = await withImap(async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = (await client.search({ all: true }, { uid: true })).filter((u) => u > lastUid).sort((a, b) => b - a);
        for (const uid of uids) {
          const msg = await client.fetchOne(uid, { source: true }, { uid: true });
          const parsed = await simpleParser(msg.source);
          const toText = (parsed.to && parsed.to.text) || '';
          if (!toText || toText.toLowerCase().includes(email.toLowerCase())) {
            return `${parsed.subject || ''}\n${parsed.text || ''}`;
          }
        }
        return null;
      } finally {
        lock.release();
      }
    });
    if (text) return extractOtp(text);
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`No new Gmail OTP mail for ${email} after ${(MAX_POLLS * POLL_MS) / 1000}s`);
}

module.exports = { markInbox, fetchOtp, extractOtp };
