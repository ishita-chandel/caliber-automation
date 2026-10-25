const { test, expect } = require('../../../fixtures/admin.fixtures');

test('inspect gender dropdown HTML in instructor modal', async ({ page, adminLogin }) => {
  await adminLogin.navigate();
  await adminLogin.login();
  await adminLogin.expectLoggedIn();

  await page.goto('https://calibercard-range.yatilabs.com/settings/instructor');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.locator('.overlay-main, [class*="overlay" i], [class*="loader" i]').first().waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});

  const addBtn = page.getByRole('button', { name: /^add$/i }).or(page.locator('button:has-text("Add")')).first();
  await addBtn.click();
  await page.waitForTimeout(500);

  const addNewBtn = page.getByRole('button', { name: /add new/i }).or(page.locator('button:has-text("Add New")')).first();
  await addNewBtn.click();
  await page.waitForTimeout(500);

  // Check the HTML of Gender field container
  const modal = page.locator('#modalLane2');
  const genderContainerHtml = await modal.locator('.form-field, .col-md-6, .mb-3, div').filter({ hasText: /^Gender/ }).first().evaluate(el => el.outerHTML);
  console.log('GENDER_CONTAINER_HTML:', genderContainerHtml);

  // Click the button for Gender
  const genderBtn = modal.locator('button#gender, [id="gender"]').first();
  await genderBtn.click();
  await page.waitForTimeout(500);

  // Inspect the options that appeared
  const optionsHtml = await page.locator('.custom-select-options, ul.dropdown-menu, [role="listbox"], .dropdown-menu.show').evaluateAll(els =>
    els.map(el => el.outerHTML)
  );
  console.log('OPTIONS_HTML:', optionsHtml);
});
