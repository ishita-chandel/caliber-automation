const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { tryPick } = require('../utils/smart-locator');

/**
 * Signup + Login (email OTP).
 * Every list below = candidate locators, first visible one is used.
 * Put the REAL selector (from `npm run codegen`) at the top of a list to make it exact.
 */
const EMAIL = [
  (p) => p.locator('input[type="email"]'),
  (p) => p.getByPlaceholder(/e-?mail/i),
  (p) => p.getByLabel(/e-?mail/i),
  (p) => p.locator('input[name*="email" i], input[id*="email" i]'),
];
const FIRST_NAME = [
  (p) => p.getByPlaceholder(/first name/i),
  (p) => p.getByLabel(/first name/i),
  (p) => p.locator('input[name*="first" i]'),
];
const LAST_NAME = [
  (p) => p.getByPlaceholder(/last name/i),
  (p) => p.getByLabel(/last name/i),
  (p) => p.locator('input[name*="last" i]'),
];
const PHONE = [
  (p) => p.locator('input[type="tel"]'),
  (p) => p.getByPlaceholder(/phone|mobile/i),
  (p) => p.getByLabel(/phone|mobile/i),
];
const SIGNUP_LINK = [
  (p) => p.getByRole('link', { name: /sign ?up|register|create (an )?account|new user|get started/i }),
  (p) => p.getByRole('button', { name: /sign ?up|register|create (an )?account|new user|get started/i }),
  (p) => p.getByText(/sign ?up|register|create (an )?account/i),
];
const LOGIN_LINK = [
  (p) => p.getByRole('link', { name: /log ?in|sign ?in/i }),
  (p) => p.getByRole('button', { name: /log ?in|sign ?in/i }),
];
const SEND_OTP = [
  (p) => p.getByRole('button', { name: /send (otp|code)|get (otp|code)|request (otp|code)/i }),
  (p) => p.getByRole('button', { name: /continue|next|log ?in|sign ?in|sign ?up|register|create account|submit/i }),
  (p) => p.locator('button[type="submit"]'),
];
const VERIFY = [
  (p) => p.getByRole('button', { name: /verify|confirm|submit|log ?in|sign ?in|continue/i }),
  (p) => p.locator('button[type="submit"]'),
];
// one box for the whole code, OR one box per digit
const OTP_SELECTOR = [
  'input[autocomplete="one-time-code"]',
  'input[name*="otp" i]',
  'input[id*="otp" i]',
  'input[placeholder*="otp" i]',
  'input[placeholder*="code" i]',
  'input[maxlength="1"]',
].join(', ');

class AuthPage extends BasePage {
  otpBoxes() {
    return this.page.locator(OTP_SELECTOR);
  }

  async openLogin() {
    await this.goto('/');
    const emailVisible = await tryPick(this.page, EMAIL, { label: 'email field', timeout: 4000 });
    if (!emailVisible) await this.clickIfPresent(LOGIN_LINK, 'login link');
  }

  async openSignup() {
    await this.goto('/');
    const clicked = await this.clickIfPresent(SIGNUP_LINK, 'signup link', 5000);
    if (!clicked) {
      console.log('[info] No separate signup link found - continuing with the email OTP screen (many apps auto-register).');
    }
  }

  async fillEmail(email) {
    await this.fill(EMAIL, email, 'email field');
  }

  /** Fills whatever signup fields exist on the screen (name / phone are optional). */
  async fillSignupForm(user) {
    await this.fillIfPresent(FIRST_NAME, user.firstName, 'first name');
    await this.fillIfPresent(LAST_NAME, user.lastName, 'last name');
    await this.fillEmail(user.email);
    if (user.phone) await this.fillIfPresent(PHONE, user.phone, 'phone');
    await this.shot('signup-form-filled');
  }

  /** Clicks Send OTP / Continue and waits until the OTP screen is there. */
  async submitForOtp() {
    await this.click(SEND_OTP, 'send OTP / continue button');
    await this.otpBoxes().first().waitFor({ state: 'visible', timeout: 20000 });
    await this.shot('otp-screen');
  }

  async enterOtp(otp) {
    const boxes = this.otpBoxes();
    await boxes.first().waitFor({ state: 'visible', timeout: 15000 });

    const visible = [];
    const total = await boxes.count();
    for (let i = 0; i < total; i++) {
      if (await boxes.nth(i).isVisible().catch(() => false)) visible.push(boxes.nth(i));
    }

    if (visible.length <= 1) {
      await visible[0].fill(otp);
    } else {
      for (let i = 0; i < otp.length && i < visible.length; i++) await visible[i].fill(otp[i]);
    }

    // some apps auto-submit once the last digit is typed, some need a click
    await this.clickIfPresent(VERIFY, 'verify button', 3000);
  }

  /** Logged in = OTP screen is gone and the app is not complaining about the code. */
  async expectLoggedIn() {
    await expect(this.otpBoxes().first(), 'OTP screen should disappear after a valid code').toBeHidden({ timeout: 30000 });
    const error = this.page.getByText(/invalid (otp|code)|incorrect|expired|wrong (otp|code)/i).first();
    const rejected = await error.isVisible().catch(() => false);
    expect(rejected, 'App rejected the OTP').toBeFalsy();
    await this.waitReady();
    await this.shot('logged-in');
  }
}

module.exports = { AuthPage };
