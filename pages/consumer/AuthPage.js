const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');

/**
 * Consumer Portal Auth Page — Login with Email OTP
 *
 * Verified selectors (https://calibercard.yatilabs.com):
 *   Email/phone input : input#phone-or-email
 *   GET CODE button   : button[type="submit"] with text "GET CODE"
 *   OTP inputs        : input#otp-0 … input#otp-3  (maxlength=1 each)
 *   VERIFY button     : button[type="submit"] with text "VERIFY & CONTINUE"
 *   Cookie consent    : #cookie-accept-btn
 *   Login button      : button.button--small containing "LOGIN"
 */

// OTP inputs — 4 individual digit boxes
const OTP_BOXES_SELECTOR = 'input[id^="otp-"], input[name^="otp-"], input[maxlength="1"]';

const SIGNUP_LINK = [
  (p) => p.getByRole('link', { name: /sign ?up|register|create (an )?account|new user|get started/i }),
  (p) => p.getByRole('button', { name: /sign ?up|register|create (an )?account|new user|get started/i }),
];

const VERIFY_BTN = [
  (p) => p.getByRole('button', { name: /verify.*continue|verify/i }),
  (p) => p.locator('button[type="submit"]').filter({ hasText: /verify/i }),
  (p) => p.locator('button[type="submit"]').first(),
];

class AuthPage extends BasePage {
  otpBoxes() {
    return this.page.locator(OTP_BOXES_SELECTOR);
  }

  /** Dismiss cookie consent banner if present */
  async dismissCookieBanner() {
    const btn = this.page
      .locator('#cookie-accept-btn, button:has-text("Accept All"), button:has-text("Accept")')
      .first();
    if (await btn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await btn.click();
      await this.page.waitForTimeout(300);
    }
  }

  /**
   * Navigate to home and click the LOGIN button → lands on /signin.
   * If the email input is already visible (e.g. direct navigation), skips the click.
   */
  async openLogin() {
    await this.goto('/');
    await this.dismissCookieBanner();
    const emailAlreadyVisible = await this.page
      .locator('input#phone-or-email')
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!emailAlreadyVisible) {
      const loginBtn = this.page
        .locator('button.button--small')
        .filter({ hasText: /^login$/i })
        .or(this.page.getByRole('link', { name: /^login$/i }))
        .first();
      await loginBtn.waitFor({ state: 'visible', timeout: 10000 });
      await loginBtn.click();
      await this.page.waitForURL(/signin/, { timeout: 15000 });
    }
    await this.page.locator('input#phone-or-email').waitFor({ state: 'visible', timeout: 10000 });
    await this.shot('consumer-login-page');
  }

  async openSignup() {
    await this.goto('/');
    await this.dismissCookieBanner();
    const clicked = await this.clickIfPresent(SIGNUP_LINK, 'signup link', 5000);
    if (!clicked) {
      console.log('[info] No separate signup link found — continuing on the email screen.');
    }
  }

  async fillEmail(email) {
    const input = this.page
      .locator('input#phone-or-email, input[name="phone-or-email"]')
      .first();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill(email);
  }

  /** Fills available signup fields (name/phone optional). */
  async fillSignupForm(user) {
    await this.fillEmail(user.email);
    await this.shot('signup-form-filled');
  }

  /**
   * Click "GET CODE" and wait for OTP inputs to appear.
   * The button briefly shows "SENDING…" while the API call is in flight.
   */
  async submitForOtp() {
    const getCodeBtn = this.page
      .getByRole('button', { name: /get code/i })
      .or(this.page.locator('button[type="submit"]').filter({ hasText: /get code/i }))
      .first();
    await getCodeBtn.waitFor({ state: 'visible', timeout: 10000 });
    await getCodeBtn.click();
    // Wait until at least one OTP input appears (up to 30s for server to send email + UI update)
    await this.page.locator(OTP_BOXES_SELECTOR).first().waitFor({ state: 'visible', timeout: 30000 });
    await this.shot('otp-screen');
  }

  /**
   * Enter the 4-digit OTP into individual digit boxes.
   * Falls back to filling a single field if only one box is visible.
   */
  async enterOtp(otp) {
    const boxes = this.page.locator(OTP_BOXES_SELECTOR);
    await boxes.first().waitFor({ state: 'visible', timeout: 15000 });

    const total = await boxes.count();
    const visible = [];
    for (let i = 0; i < total; i++) {
      if (await boxes.nth(i).isVisible().catch(() => false)) visible.push(boxes.nth(i));
    }

    if (visible.length <= 1) {
      await visible[0].fill(otp);
    } else {
      for (let i = 0; i < otp.length && i < visible.length; i++) {
        await visible[i].fill(otp[i]);
      }
    }

    // Click VERIFY & CONTINUE (some apps auto-submit after last digit)
    await this.clickIfPresent(VERIFY_BTN, 'VERIFY & CONTINUE button', 3000);
  }

  /** Confirmed logged-in: OTP screen is gone, no error text visible */
  async expectLoggedIn() {
    await expect(
      this.page.locator(OTP_BOXES_SELECTOR).first(),
      'OTP screen should disappear after a valid code',
    ).toBeHidden({ timeout: 30000 });
    const error = this.page
      .getByText(/invalid (otp|code)|incorrect|expired|wrong (otp|code)/i)
      .first();
    const rejected = await error.isVisible().catch(() => false);
    expect(rejected, 'App rejected the OTP').toBeFalsy();
    await this.waitReady();
    await this.shot('consumer-logged-in');
  }
}

module.exports = { AuthPage };
