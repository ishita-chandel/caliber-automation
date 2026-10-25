const fs = require('fs');
const path = require('path');
const { test, expect } = require('../../../fixtures/admin.fixtures');
const cfg = require('../../../utils/config');

test.describe('Range Admin Portal Authentication', () => {
  test.beforeEach(async ({ adminLogin }) => {
    await adminLogin.navigate();
  });

  test('valid login with authorized credentials and session persistence', async ({ adminLogin, context }) => {
    test.setTimeout(60_000);

    await test.step('enter credentials and click sign in', async () => {
      await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
    });

    await test.step('verify successful authentication and dashboard access', async () => {
      await adminLogin.expectLoggedIn();
    });

    await test.step('save authenticated admin session state', async () => {
      fs.mkdirSync(path.dirname(cfg.ADMIN_AUTH_FILE), { recursive: true });
      await context.storageState({ path: cfg.ADMIN_AUTH_FILE });
      console.log(`[admin-login] Session successfully saved to ${cfg.ADMIN_AUTH_FILE}`);
    });
  });

  test('reject login with invalid password', async ({ adminLogin }) => {
    await test.step('submit credentials with incorrect password', async () => {
      await adminLogin.fillEmail(cfg.ADMIN_EMAIL);
      await adminLogin.fillPassword('WrongPassword@999');
      await adminLogin.clickSignIn();
    });

    await test.step('verify authentication failure error message', async () => {
      await adminLogin.expectLoginError(/invalid|incorrect|failed|wrong|unauthorized|user/i);
    });
  });

  test('validate required fields on empty submission', async ({ adminLogin, page }) => {
    await test.step('click sign in without filling credentials', async () => {
      await adminLogin.clickSignIn();
    });

    await test.step('assert validation errors or form remains unsubmitted', async () => {
      const emailInput = page.locator('input[type="email"], input[name*="email" i], input').first();
      const isRequired = await emailInput.getAttribute('required');
      const validationMsg = await emailInput.evaluate((el) => el.validationMessage || '');
      const errorDisplayed = await page.locator('[role="alert"], [class*="error" i], [class*="help" i]').count() > 0;
      expect(isRequired !== null || validationMsg !== '' || errorDisplayed, 'Empty form must prompt for required fields').toBeTruthy();
    });
  });
});

