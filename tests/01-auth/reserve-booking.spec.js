const fs = require('fs');
const path = require('path');
const { test, expect } = require('../../fixtures/test-fixtures');
const cfg = require('../../utils/config');
const { loadUser } = require('../../utils/data-factory');
const { markInbox, fetchOtp } = require('../../utils/otp-helper');

const BASE = 'https://calibercard.yatilabs.com';

// ---------------- Test data (change only here) ----------------
const BOOKING = {
  rangeSlug: 'range-test-2-1',
  slotTime: '08:00',
  skillLevel: 'Novice/Never Ever',
  firearm: 'Handgun',
  notes: 'Automation test booking - please ignore.',
};

// ---------------- Helpers ----------------

// Custom (non-native) dropdown: click placeholder, pick the <li>.
async function pickFromDropdown(page, placeholder, optionText) {
  const trigger = page
    .locator('div')
    .filter({ hasText: new RegExp(`^${placeholder}$`) })
    .last();
  await expect(trigger).toBeVisible();
  await trigger.click();
  const option = page.getByRole('listitem').filter({ hasText: optionText }).first();
  await expect(option).toBeVisible();
  await option.click();
}

// Draw a signature inside the waiver canvas (more reliable than a fixed-coordinate click).
async function drawSignature(page) {
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  const x = box.x + box.width / 4;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y - 25, { steps: 8 });
  await page.mouse.move(x + 120, y + 25, { steps: 8 });
  await page.mouse.move(x + 180, y - 10, { steps: 8 });
  await page.mouse.up();
}

// Open the target range by trying each "VIEW AVAILABILITY" button until the URL matches the slug.
async function openRange(page, slug) {
  const buttons = page.getByRole('button', { name: 'VIEW AVAILABILITY' });
  await expect(buttons.first()).toBeVisible();
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    await buttons.nth(i).click();
    try {
      await expect(page).toHaveURL(new RegExp(`/range-detail/${slug}`), { timeout: 5_000 });
      return;
    } catch {
      await page.goBack();
      await expect(buttons.first()).toBeVisible();
    }
  }
  throw new Error(`Range "${slug}" not found among ${count} ranges on /find-range`);
}

// ---------------- Test ----------------

test('reserve booking: OTP login -> find range -> slot -> waiver -> reserve', async ({ auth, context, page }) => {
  test.setTimeout(180_000);

  const user = loadUser();
  console.log(`[reserve] user: ${user.email} (${user.provider})`);

  // ===== 1. LOGIN (dynamic OTP from otp-helper) =====
  await test.step('1.1 open login and enter email', async () => {
    await auth.openLogin();
    await auth.fillEmail(user.email);
  });

  const marker = await test.step('1.2 remember current inbox state', () => markInbox(context, user.email));

  await test.step('1.3 request OTP (GET CODE)', () => auth.submitForOtp());

  const otp = await test.step('1.4 read NEW OTP from inbox', () => fetchOtp(context, user.email, marker));
  console.log(`[reserve] OTP received: ${otp}`);

  await test.step('1.5 enter OTP, VERIFY & CONTINUE', async () => {
    await auth.enterOtp(otp);
    await auth.expectLoggedIn();
  });

  await test.step('1.6 dashboard URL check', async () => {
    await expect(page).toHaveURL(`${BASE}/overview`);
  });

  // keep session for other specs (RSVP / Experience)
  fs.mkdirSync(path.dirname(cfg.AUTH_FILE), { recursive: true });
  await context.storageState({ path: cfg.AUTH_FILE });

  // ===== 2. FIND A RANGE =====
  await test.step('2. navigate to Find a Range', async () => {
    await page.getByRole('link', { name: 'Find a Range', exact: true }).click();
    await expect(page).toHaveURL(`${BASE}/find-range`);
  });

  // ===== 3. SELECT RANGE =====
  await test.step('3. select range -> range detail page', async () => {
    await openRange(page, BOOKING.rangeSlug);
    await expect(page).toHaveURL(`${BASE}/range-detail/${BOOKING.rangeSlug}`);
  });

  // ===== 4. TIME SLOT =====
  await test.step(`4. select time slot ${BOOKING.slotTime}`, async () => {
    const slot = page.getByText(BOOKING.slotTime).first();
    await expect(slot).toBeVisible();
    await slot.click();
  });

  // ===== 5. SKILL LEVEL =====
  await test.step('5. select skill level', async () => {
    await pickFromDropdown(page, 'Select Skill Level', BOOKING.skillLevel);
  });

  // ===== 6. FIREARM =====
  await test.step('6. select firearm: Handgun', async () => {
    await pickFromDropdown(page, 'Select Firearm', BOOKING.firearm);
  });

  // ===== 7. NOTES =====
  await test.step('7. add notes', async () => {
    const note = page.getByRole('textbox', { name: 'Note' });
    await note.fill(BOOKING.notes);
    await expect(note).toHaveValue(BOOKING.notes);
  });

  // ===== 8. WAIVER + CHECKBOXES =====
  await test.step('8.1 sign waiver', async () => {
    await page.getByRole('button', { name: 'Sign Waiver' }).click();
    await drawSignature(page);
    await page.getByRole('checkbox', { name: /I acknowledge that I have/i }).check();
    await page.getByRole('button', { name: 'SUBMIT' }).click();
  });

  await test.step('8.2 agree to Range Policies', async () => {
    const policies = page.getByRole('checkbox', { name: 'I agree to the Range Policies.' });
    await expect(policies).toBeVisible();
    await policies.check();
    await expect(policies).toBeChecked();
  });

  // ===== 9. RESERVE =====
  await test.step('9. click Reserve', async () => {
    const reserve = page.getByRole('button', { name: 'Reserve' });
    await expect(reserve).toBeEnabled();
    await reserve.click();
  });

  // ===== 10. VERIFY (adjust to your real success signal) =====
  await test.step('10. verify reservation went through', async () => {
    await expect(page.getByText(/reserved|success|added to cart|cart/i).first())
      .toBeVisible({ timeout: 15_000 });
  });
});