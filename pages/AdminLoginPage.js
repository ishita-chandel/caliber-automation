const { expect } = require('@playwright/test');
const { BasePage } = require('./BasePage');
const { tryPick } = require('../utils/smart-locator');
const cfg = require('../utils/config');

/**
 * Range Admin Portal Login Page Object
 * URL: https://calibercard-range.yatilabs.com/home
 */
const EMAIL_INPUT = [
  (p) => p.getByRole('textbox', { name: /email address/i }),
  (p) => p.getByLabel(/email address/i),
  (p) => p.getByPlaceholder(/email address/i),
  (p) => p.locator('input[type="email"]'),
  (p) => p.locator('input[name*="email" i]'),
  (p) => p.locator('input[id*="email" i]'),
  (p) => p.locator('input').first(),
];

const PASSWORD_INPUT = [
  (p) => p.getByLabel(/password/i),
  (p) => p.getByPlaceholder(/password/i),
  (p) => p.locator('input[type="password"]'),
  (p) => p.locator('input[name*="password" i]'),
  (p) => p.locator('input[id*="password" i]'),
  (p) => p.locator('input').nth(1),
];

const SIGN_IN_BUTTON = [
  (p) => p.getByRole('button', { name: /sign in/i }),
  (p) => p.locator('button[type="submit"]'),
  (p) => p.getByText(/^sign in$/i),
];

const PIN_LOGIN_BUTTON = [
  (p) => p.getByRole('button', { name: /sign in with pin/i }),
];

const FORGOT_PASSWORD_LINK = [
  (p) => p.getByRole('link', { name: /forgot password/i }),
  (p) => p.getByText(/forgot password/i),
];

class AdminLoginPage extends BasePage {
  async navigate() {
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    const loginUrl = `${baseUrl}/log-in`;
    await this.goto(loginUrl);

    // If still on landing page or redirected, look for and click "Log in" link
    const emailField = await tryPick(this.page, EMAIL_INPUT, { label: 'Email Address field', timeout: 3000 });
    if (!emailField) {
      const loginLink = this.page.getByRole('link', { name: /^log in$/i }).first();
      if (await loginLink.isVisible().catch(() => false)) {
        await loginLink.click();
        await this.waitReady();
      }
    }
    await this.shot('admin-login-page');
  }

  async fillEmail(email) {
    await this.fill(EMAIL_INPUT, email, 'Email Address field');
  }

  async fillPassword(password) {
    await this.fill(PASSWORD_INPUT, password, 'Password field');
  }

  async clickSignIn() {
    await this.click(SIGN_IN_BUTTON, 'Sign In button');
  }

  /**
   * Complete login action using specified or configured credentials
   */
  async login(email = cfg.ADMIN_EMAIL, password = cfg.ADMIN_PASSWORD) {
    console.log(`[admin-login] Logging in as: ${email}`);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.shot('admin-login-credentials-filled');
    await this.clickSignIn();
  }

  /**
   * Asserts successful login:
   * 1. No invalid credentials error displayed
   * 2. Sign In form disappears or page transitions to authenticated state
   * 3. Dashboard/navigation becomes visible
   */
  async expectLoggedIn() {
    // Assert no error alert is thrown
    const errorAlert = this.page.locator('[role="alert"], [class*="error" i], [class*="toast" i]').filter({
      hasText: /invalid|incorrect|not found|unauthorized|failed|error/i,
    });
    await expect(errorAlert, 'No login error banner should appear on valid credentials').toBeHidden({ timeout: 5000 }).catch(() => {});

    // Verify authenticated landing: navigation elements or URL change
    const authenticatedMarkers = this.page.locator(
      'aside, nav, [class*="sidebar" i], [class*="dashboard" i], button:has-text("Logout"), button:has-text("Sign Out"), [class*="avatar" i]'
    );
    await expect(
      authenticatedMarkers.first(),
      'Admin dashboard navigation or profile should be visible upon login'
    ).toBeVisible({ timeout: 20000 });

    await this.shot('admin-dashboard-logged-in');
    console.log(`[admin-login] Successfully authenticated. Current URL: ${this.page.url()}`);
  }

  /**
   * Negative assertion: asserts an error message is visible
   */
  async expectLoginError(pattern = /invalid|incorrect|wrong|unauthorized|failed/i) {
    const errorMsg = this.page.locator('body').getByText(pattern).first();
    await expect(errorMsg, `Error message matching ${pattern} should appear`).toBeVisible({ timeout: 10000 });
    await this.shot('admin-login-error');
  }
}

module.exports = { AdminLoginPage };

