const { test, expect } = require('../../fixtures/test-fixtures');
const cfg = require('../../utils/config');
const { generateExperienceData, generateProductData } = require('../../utils/data-factory');

test.describe('Range Admin - Class / Experience Creation Flow', () => {
  test.beforeEach(async ({ adminLogin }) => {
    // Authenticate with Range Admin credentials
    await adminLogin.navigate();
    await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
    await adminLogin.expectLoggedIn();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POSITIVE SCENARIO: Complete Class / Experience Creation Flow
  // ═══════════════════════════════════════════════════════════════════════
  test('positive: create class/experience through general, product popup, verify in list, review, and save', async ({
    expCreate,
  }) => {
    test.setTimeout(180_000);

    const expData = generateExperienceData({
      name: `Shooting Masterclass ${Date.now()}`,
      shortDescription: 'Comprehensive tactical shooting class for all skill levels.',
      longDescription: '2-hour complete class covering range safety, grip, stance, trigger control, and live shooting drills.',
      skillLevel: 'Beginner',
      sessionDuration: '2 Hours',
      coins: 10,
      active: true,
    });

    const productData = generateProductData({
      name: `Ticket - ${expData.name}`,
      regularPrice: 150, // Always keep regular price high
      salePrice: 99, // Always keep sale price less
      stock: 40,
      minOrderQty: 1,
      description: 'Standard admission ticket with range access and certified coach guidance.',
    });

    // 1. Navigate to Experiences > Add
    await test.step('navigate to Experiences > Add Experience', async () => {
      await expCreate.navigateViaMenu();
    });

    // 2. Add data in General tab
    await test.step('enter experience details in General tab', async () => {
      await expCreate.fillGeneralDetails(expData);
    });

    // 3. Scroll down and click Save on General tab, then wait for Product page
    await test.step('scroll down, click Save, and wait for navigation to Product page', async () => {
      await expCreate.scrollAndSaveGeneral();
      await expCreate.waitForProductPage();
    });

    // 4. Click Add button on Product page
    await test.step('click "+ Add" on Product page to open Add Product popup', async () => {
      await expCreate.clickAddProduct();
    });

    // 5. Fill product popup: regular price high, sale price less, Active checked, and Save
    await test.step('fill Add Product popup (regular high, sale less, active checked) and click Save', async () => {
      await expCreate.fillProductPopup(productData);
      await expCreate.saveProductPopup();
    });

    // 6. Verify added product appears on the product list page
    await test.step('verify added product is displayed in the product list after popup closes', async () => {
      await expCreate.verifyProductInList(productData.name);
    });

    // 7. Click Next button to navigate to Review page
    await test.step('click Next to navigate to Review page', async () => {
      await expCreate.clickNext();
    });

    // 8. Verify added details are properly loaded on Review page
    await test.step('verify all added details are correct on Review page', async () => {
      await expCreate.verifyReviewPageDetails(expData, productData);
    });

    // 9. Scroll down on Review page and click Save Experience
    await test.step('scroll down and click Save Experience', async () => {
      await expCreate.scrollAndSaveExperience();
      await expCreate.expectExperienceCreated(expData.name);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // NEGATIVE SCENARIO 1: Empty Required Fields on General Tab
  // ═══════════════════════════════════════════════════════════════════════
  test('negative 1: submit General tab without required Name — expect validation error and block navigation', async ({
    expCreate,
  }) => {
    await test.step('navigate to Experiences > Add', async () => {
      await expCreate.navigateViaMenu();
    });

    await test.step('clear Name field, scroll down, and click Save', async () => {
      await expCreate.clearGeneralFields();
      await expCreate.scrollAndClickSaveOnGeneral();
    });

    await test.step('verify validation error prevents advancing to Product step', async () => {
      await expCreate.expectGeneralValidationErrors();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // NEGATIVE SCENARIO 2: Invalid Product Pricing (Sale Price >= Regular Price)
  // ═══════════════════════════════════════════════════════════════════════
  test('negative 2: reject Add Product popup when sale price exceeds or equals regular price', async ({
    expCreate,
  }) => {
    test.setTimeout(120_000);

    const expData = generateExperienceData({ name: `Neg Pricing Class ${Date.now()}` });

    await test.step('navigate and complete General step to reach Product page', async () => {
      await expCreate.navigateViaMenu();
      await expCreate.fillGeneralDetails(expData);
      await expCreate.scrollAndSaveGeneral();
      await expCreate.waitForProductPage();
    });

    await test.step('open Add Product popup and enter invalid pricing (sale price higher than regular)', async () => {
      await expCreate.clickAddProduct();

      // Enter invalid pricing: Regular $100, Sale $150 (violating pricing constraint)
      const modal = expCreate.productModal();
      await modal.locator('input[type="text"]').first().fill('Invalid Price Product');

      const regInput = modal.locator('input[placeholder*="$" i]').nth(0).or(modal.locator('input[type="number"]').nth(0));
      if (await regInput.isVisible().catch(() => false)) {
        await regInput.fill('100');
      }

      const saleInput = modal.locator('input[placeholder*="$" i]').nth(1).or(modal.locator('input[type="number"]').nth(1));
      if (await saleInput.isVisible().catch(() => false)) {
        await saleInput.fill('150'); // Invalid: sale higher than regular
      }

      const activeChk = modal.locator('input[type="checkbox"]').first().or(modal.locator('#gridCheck'));
      if (await activeChk.count() > 0) {
        await activeChk.check({ force: true }).catch(() => {});
      }

      await expCreate.shot('exp-negative-pricing-input');
    });

    await test.step('click Save in popup and verify pricing error prevents product addition', async () => {
      const modal = expCreate.productModal();
      await modal.locator('button:has-text("Save")').first().click({ force: true });
      await expCreate.expectProductPricingError();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // NEGATIVE SCENARIO 3: Cancel Product Popup — Product Not Added to List
  // ═══════════════════════════════════════════════════════════════════════
  test('negative 3: cancel Add Product popup — verify product is not added to list', async ({
    expCreate,
  }) => {
    test.setTimeout(120_000);

    const expData = generateExperienceData({ name: `Cancel Product Class ${Date.now()}` });
    const cancelledProductName = `Discarded Product ${Date.now()}`;

    await test.step('navigate and complete General step to reach Product page', async () => {
      await expCreate.navigateViaMenu();
      await expCreate.fillGeneralDetails(expData);
      await expCreate.scrollAndSaveGeneral();
      await expCreate.waitForProductPage();
    });

    await test.step('open Add Product popup and enter product name', async () => {
      await expCreate.clickAddProduct();
      const modal = expCreate.productModal();
      await modal.locator('input[type="text"]').first().fill(cancelledProductName);
    });

    await test.step('click Cancel in popup', async () => {
      await expCreate.cancelProductPopup();
    });

    await test.step('verify cancelled product does NOT appear in the product list', async () => {
      const productRow = expCreate.page
        .locator('table, tbody, tr, [class*="list" i], [class*="table" i]')
        .filter({ hasText: cancelledProductName })
        .first();

      const isVisible = await productRow.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible, `Cancelled product "${cancelledProductName}" should NOT appear in product list`).toBeFalsy();
      console.log(`[exp-create] Confirmed: Cancelled product "${cancelledProductName}" is not in list`);
      await expCreate.shot('exp-cancel-confirmed');
    });
  });
});
