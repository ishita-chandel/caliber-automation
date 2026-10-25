const { test, expect } = require('@playwright/test');
const cfg = require('../../utils/config');
const { snap } = require('../../utils/smart-locator');

// Range admin portal: opens the admin URL and checks that the app loads.
// Add admin login steps here once you share the admin login method (password or OTP).
test('admin: range admin portal loads', async ({ page }) => {
  const response = await page.goto(cfg.ADMIN_URL, { waitUntil: 'domcontentloaded' });
  expect(response && response.status(), 'admin URL should respond without an error').toBeLessThan(400);

  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await snap(page, 'admin-home');

  await expect(page.locator('body')).not.toBeEmpty();
  await expect(page.getByText(/application error|something went wrong|404|not found/i).first()).toBeHidden();
});
