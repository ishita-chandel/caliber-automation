const { test, expect } = require('../../../fixtures/admin.fixtures');
const cfg = require('../../../utils/config');
const {
  createUniqueExperienceData,
  createUniqueProductData,
} = require('../../../utils/data-factory');

// ═══════════════════════════════════════════════════════════════════════════
// Range Admin – Experience / Class Creation (5 Focused Test Cases)
// 1 Positive Flow + 4 Essential Negative Cases
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Range Admin – Experience / Class Creation', () => {
  test.beforeEach(async ({ adminLogin }) => {
    await adminLogin.navigate();
    await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
    await adminLogin.expectLoggedIn();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 1. POSITIVE FLOW (TC01)
  // ═══════════════════════════════════════════════════════════════════════
  test('TC01 - positive: create experience end-to-end (general, product modal, list verify, review, save)', async ({
    expCreate,
  }) => {
    test.setTimeout(180_000);

    const expData = createUniqueExperienceData();
    const productData = createUniqueProductData({
      regularPrice: '100.00',
      salePrice: '80.00',
      stock: '50',
      minOrderQty: '1',
    });

    await test.step('navigate to Experiences > Add Experience', async () => {
      await expCreate.navigateViaMenu();
    });

    await test.step('fill General tab with valid data', async () => {
      await expCreate.fillGeneralDetails(expData);
    });

    await test.step('save General and navigate to Product page', async () => {
      await expCreate.scrollAndSaveGeneral();
      await expCreate.waitForProductPage();
    });

    await test.step('open Add Product popup, fill valid pricing and details, and save', async () => {
      await expCreate.clickAddProduct();
      await expCreate.fillProductPopup(productData);
      await expCreate.saveProductPopup();
    });

    await test.step('verify added product is visible in the product list', async () => {
      await expCreate.verifyProductInList(productData.name);
    });

    await test.step('click Next to proceed to Review page', async () => {
      await expCreate.clickNext();
    });

    await test.step('verify experience and product details on Review page', async () => {
      await expCreate.verifyReviewPageDetails(expData, productData);
    });

    await test.step('scroll down, click Save Experience, and verify creation in list', async () => {
      await expCreate.scrollAndSaveExperience();
      await expCreate.expectExperienceCreated(expData.name);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. NEGATIVE CASES (TC02 – TC05)
  // ═══════════════════════════════════════════════════════════════════════

  // ── TC02: Required Field Missing on General Tab ──────────────────────
  test('TC02 - negative: submit General tab without required Name - verify validation error blocks navigation', async ({
    expCreate,
  }) => {
    await test.step('navigate to Experiences > Add', async () => {
      await expCreate.navigateViaMenu();
    });

    await test.step('clear Name field and attempt to Save', async () => {
      await expCreate.clearGeneralFields();
      await expCreate.scrollAndClickSaveOnGeneral();
    });

    await test.step('verify validation error prevents advancing to Product step', async () => {
      await expCreate.expectGeneralValidationErrors();
    });
  });

  // ── TC03: Invalid Product Pricing (Sale Price >= Regular Price) ───────
  test('TC03 - negative: reject Add Product popup when sale price exceeds regular price', async ({
    expCreate,
  }) => {
    test.setTimeout(120_000);

    const expData = createUniqueExperienceData();

    await test.step('navigate and complete General step to reach Product page', async () => {
      await expCreate.navigateViaMenu();
      await expCreate.fillGeneralDetails(expData);
      await expCreate.scrollAndSaveGeneral();
      await expCreate.waitForProductPage();
    });

    await test.step('open Add Product popup and enter invalid pricing (sale price higher than regular)', async () => {
      await expCreate.clickAddProduct();
      await expCreate.fillProductPopupWithInvalidPricing({
        name: `Invalid Price Product ${Date.now()}`,
        regularPrice: '100.00',
        salePrice: '120.00',
        stock: '50',
        minOrderQty: '1',
      });
    });

    await test.step('click Save in popup and verify pricing error keeps popup open', async () => {
      await expCreate.clickSaveInProductPopup();
      await expCreate.expectProductPricingError();
    });
  });

  // ── TC04: Cancel Add Product Popup ───────────────────────────────────
  test('TC04 - negative: cancel Add Product popup - verify product is not added to list', async ({
    expCreate,
  }) => {
    test.setTimeout(120_000);

    const expData = createUniqueExperienceData();
    const cancelledName = `Cancelled Product ${Date.now()}`;

    await test.step('navigate through General step to Product page', async () => {
      await expCreate.navigateViaMenu();
      await expCreate.fillGeneralDetails(expData);
      await expCreate.scrollAndSaveGeneral();
      await expCreate.waitForProductPage();
    });

    await test.step('open Add Product popup, enter name, and click Cancel', async () => {
      await expCreate.clickAddProduct();
      const modal = expCreate.productModal();
      await modal.locator('input[type="text"]').first().fill(cancelledName);
      await expCreate.cancelProductPopup();
    });

    await test.step('verify cancelled product does NOT appear in the product list', async () => {
      await expCreate.expectProductNotInList(cancelledName);
    });
  });

  // ── TC05: Required Product Field Missing ─────────────────────────────
  test('TC05 - negative: submit Add Product popup without required Name - verify product is not saved', async ({
    expCreate,
  }) => {
    test.setTimeout(120_000);

    const expData = createUniqueExperienceData();
    const productData = createUniqueProductData();

    await test.step('navigate through General step to Product page', async () => {
      await expCreate.navigateViaMenu();
      await expCreate.fillGeneralDetails(expData);
      await expCreate.scrollAndSaveGeneral();
      await expCreate.waitForProductPage();
    });

    await test.step('open Add Product popup and fill fields skipping the product Name', async () => {
      await expCreate.clickAddProduct();
      await expCreate.fillProductPopupSkipping(productData, 'name');
    });

    await test.step('click Save and verify popup remains open due to missing required field', async () => {
      await expCreate.clickSaveInProductPopup();
      await expCreate.expectProductPricingError();
    });
  });
});
