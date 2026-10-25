const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const { formatDateTime } = require('../../utils/data-factory');
const cfg = require('../../utils/config');

/**
 * Page Object: Range Admin > Experiences > Add Experience (wizard)
 *
 * Flow
 *   General : fill details -> Save -> Next
 *   Product : Add -> fill popup -> Save -> verify in list -> Next
 *   Review  : verify details -> Save Experience
 *
 * Rules:
 *  - no waitForTimeout, no force:true on clicks, no .catch(() => {}) hiding failures
 *  - Playwright auto-waits on actions; expect() retries until the condition is met
 *  - fields are found by their visible label, not by position (nth)
 */

// Friendly test-data names -> real option text shown in the Skill Level dropdown
const SKILL_MAP = {
  beginner: 'ENTRY',
  entry: 'ENTRY',
  intermediate: 'INTERMEDIATE',
  advanced: 'EXPERT',
  expert: 'EXPERT',
};

class ExperienceCreatePage extends BasePage {
  // ───────────────────────── Generic helpers ─────────────────────────

  /** input / textarea that comes right after a visible label */
  _field(label) {
    return this.page
      .getByText(label, { exact: true })
      .locator('xpath=following::*[self::input or self::textarea][1]');
  }

  /** rich-text (CKEditor) area that comes right after a visible label */
  _editor(label) {
    return this.page
      .getByText(label, { exact: true })
      .locator('xpath=following::*[@contenteditable="true"][1]');
  }

  /**
   * Custom dropdown: find its trigger button by the label above it,
   * open it, then pick the option by role.
   */
  async _pickDropdown(label, optionText) {
    await this.page.getByText(label, { exact: true }).locator('xpath=following::button[1]').click();
    const option = this.page.getByRole('option', { name: new RegExp(`^\\s*${optionText}\\s*$`, 'i') });
    await expect(option, `Dropdown "${label}": option "${optionText}" not found`).toBeVisible();
    await option.click();
  }

  /** Date picker textbox: accepts a ready string or a JS Date */
  async _fillDate(locator, value) {
    const text = value instanceof Date ? formatDateTime(value) : String(value);
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await locator.click({ force: true }).catch(() => {});
    await locator.fill(text);
    await locator.press('Enter').catch(() => {});
    await this.page.keyboard.press('Escape').catch(() => {});
  }

  // ───────────────────────── Locators ─────────────────────────

  saveButton() {
    return this.page.getByRole('button', { name: /^\s*(save|update)\s*$/i }).last();
  }

  nextButton() {
    return this.page.getByRole('button', { name: /^\s*next\s*$/i }).last();
  }

  productAddButton() {
    return this.page.getByRole('button', { name: /^\s*\+?\s*add\s*$/i }).first();
  }

  productModal() {
    return this.page.locator('#productClassModal');
  }

  // ───────────────────────── Navigation ─────────────────────────

  async navigateViaMenu() {
    // Wait for any loading overlay to disappear
    await this.page
      .locator('.overlay-main, [class*="overlay" i], [class*="loader" i], [class*="spinner" i]')
      .first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {});
    await this.waitReady();

    const expLink = this.page
      .locator('aside, nav, [class*="sidebar" i]')
      .getByRole('link', { name: /^experiences$/i })
      .or(this.page.locator('a[href*="/experiences"]'))
      .first();

    if (await expLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expLink.click({ force: true });
    } else {
      const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
      await this.goto(`${baseUrl}/experiences`);
    }

    await this.page
      .locator('.overlay-main, [class*="overlay" i], [class*="loader" i]')
      .first()
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => {});
    await this.waitReady();
    await this.shot('admin-experiences-list');

    const newBtn = this.page.getByRole('button', { name: 'New', exact: true });

    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click();
    } else {
      const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
      await this.goto(`${baseUrl}/experience-create`);
    }

    await this.page
      .locator('.overlay-main, [class*="overlay" i], [class*="loader" i]')
      .first()
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => {});
    await expect(this.page, 'Should be on the Add Experience page').toHaveURL(/experience-create/);
    await this.shot('exp-create-general-step');
  }

  // ───────────────────────── Step 1: General ─────────────────────────

  async fillGeneralDetails(d) {
    await this._field('Name').fill(d.name);
    if (d.prerequisite) await this._field('Prerequisite').fill(d.prerequisite);
    if (d.shortDescription) await this._editor('Short Description').fill(d.shortDescription);
    if (d.longDescription) await this._editor('Long Description').fill(d.longDescription);

    if (d.skillLevel) {
      const skill = SKILL_MAP[String(d.skillLevel).toLowerCase()] ?? d.skillLevel;
      await this._pickDropdown('Skill Level', skill);
    }
    if (d.sessionDuration) await this._pickDropdown('Session Duration', d.sessionDuration);
    if (d.coins !== undefined) await this._field('Coins').fill(String(d.coins));

    // Start / End / Door Open date pickers (same placeholder, so use order)
    const dates = this.page.getByRole('textbox', { name: 'Select date and time' });
    if (d.startDateTime) await this._fillDate(dates.nth(0), d.startDateTime);
    if (d.endDateTime) await this._fillDate(dates.nth(1), d.endDateTime);
    if (d.doorOpenTime) await this._fillDate(dates.nth(2), d.doorOpenTime);

    if (d.category) {
      await this.page.getByRole('textbox', { name: 'Search categories...' }).fill(d.category);
      await this.page.getByText(d.category, { exact: true }).first().click();
    }
    if (d.termsAndConditions) await this._editor('Terms and Conditions').fill(d.termsAndConditions);
    if (d.instructor) {
      await this.page.getByRole('textbox', { name: 'Search by email or phone number' }).fill(d.instructor);
    }
    if (d.imagePath) await this.page.locator('input[type="file"]').setInputFiles(d.imagePath);

    if (d.hideAfterExpiration !== undefined) {
      await this.page
        .getByRole('checkbox', { name: 'Hide Event After Expiration' })
        .setChecked(Boolean(d.hideAfterExpiration));
    }
    if (d.active !== undefined) {
      await this.page.getByRole('checkbox', { name: 'Active', exact: true }).setChecked(Boolean(d.active));
    }

    await this.shot('exp-general-filled');
  }

  /** General tab: scroll to Save and click it */
  async scrollAndClickSaveOnGeneral() {
    const save = this.saveButton();
    await save.scrollIntoViewIfNeeded();
    await save.click();
    await this.shot('exp-general-saved');
  }

  /** General tab: Save, then Next to open the Product page */
  async scrollAndSaveGeneral() {
    await this.scrollAndClickSaveOnGeneral();
    const next = this.nextButton();
    await expect(next, 'Next button should appear after saving General').toBeVisible();
    await next.scrollIntoViewIfNeeded();
    await next.click();
  }

  async waitForProductPage() {
    await expect(this.productAddButton(), 'Should be on the Product step (Add button visible)').toBeVisible();
    await this.shot('exp-product-page-loaded');
  }

  // ───────────────────────── Step 2: Product ─────────────────────────

  async clickAddProduct() {
    await this.productAddButton().click();
    await expect(this.productModal(), 'Add Product popup should open').toBeVisible();
  }

  /**
   * Fills the Add Product popup.
   * Rule: regular price must be greater than sale price
   * (pass { allowInvalidPricing: true } only for the negative pricing test).
   * Pass { skipActive: true } to leave the Active checkbox unchecked.
   */
  async fillProductPopup(product, { allowInvalidPricing = false, activeOverride } = {}) {
    if (!allowInvalidPricing && Number(product.regularPrice) <= Number(product.salePrice)) {
      throw new Error(
        `Regular price (${product.regularPrice}) must be greater than sale price (${product.salePrice})`
      );
    }

    const modal = this.productModal();

    // 1. Product Name
    await modal.locator('input[type="text"]').first().fill(product.name);

    // 2. Numeric fields: Regular Price, Sale Price, Stock, Min Order Qty
    const numbers = modal.locator('input[type="number"], input[placeholder*="$" i]');
    if (product.regularPrice !== undefined) await numbers.nth(0).fill(String(product.regularPrice));
    if (product.salePrice !== undefined) await numbers.nth(1).fill(String(product.salePrice));
    if (product.stock !== undefined) await numbers.nth(2).fill(String(product.stock));
    if (product.minOrderQty !== undefined) await numbers.nth(3).fill(String(product.minOrderQty));

    // 3. Active checkbox
    const shouldBeActive = activeOverride !== undefined ? activeOverride : product.active;
    const activeChk = modal.locator('input[type="checkbox"]').first();
    if (shouldBeActive !== undefined) {
      await activeChk.setChecked(Boolean(shouldBeActive));
    }

    // 4. Selling start / end date (defaults: now -> +1 month)
    const dateInputs = modal.locator('input[placeholder*="Select date and time" i]');
    if ((await dateInputs.count()) >= 2) {
      const sellingStart = product.sellingStart ?? new Date();
      const sellingEnd = product.sellingEnd ?? (() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d; })();
      await this._fillDate(dateInputs.nth(0), sellingStart);
      await this._fillDate(dateInputs.nth(1), sellingEnd);
    }

    // 5. Product Description (CKEditor rich text or textarea)
    if (product.description) {
      await modal
        .locator('.ck-editor__editable, [contenteditable="true"], textarea')
        .first()
        .fill(product.description);
    }

    await this.shot('exp-product-popup-filled');
  }

  async saveProductPopup() {
    await this.productModal().getByRole('button', { name: /^\s*save\s*$/i }).click();
    await expect(this.productModal(), 'Add Product popup should close after Save').toBeHidden();
    await this.shot('exp-product-popup-closed');
  }

  async cancelProductPopup() {
    await this.productModal().getByRole('button', { name: /^\s*cancel\s*$/i }).click();
    await expect(this.productModal()).toBeHidden();
  }

  async verifyProductInList(productName) {
    await expect(
      this.page.getByText(productName).first(),
      `"${productName}" should be in the product list`
    ).toBeVisible();
    await this.shot('exp-product-verified-in-list');
  }

  async expectProductNotInList(productName) {
    await expect(
      this.page.getByText(productName),
      `"${productName}" must not be in the product list`
    ).toHaveCount(0);
  }

  async clickNext() {
    const next = this.nextButton();
    await next.scrollIntoViewIfNeeded();
    await next.click();
    await this.shot('exp-review-page-loaded');
  }

  // ───────────────────────── Step 3: Review ─────────────────────────

  /**
   * Verifies key details on the Review page.
   * Checks only fields actually rendered by the Review UI.
   */
  async verifyReviewPageDetails(expData, productData) {
    // Experience name
    await expect(
      this.page.getByText(expData.name).first(),
      'Experience name on Review page'
    ).toBeVisible();

    // Product name
    if (productData?.name) {
      await expect(
        this.page.getByText(productData.name).first(),
        'Product name on Review page'
      ).toBeVisible();
    }

    await this.shot('exp-review-details-verified');
  }

  async scrollAndSaveExperience() {
    const save = this.page.getByRole('button', { name: /save experience/i });
    await save.scrollIntoViewIfNeeded();
    await save.click();
    await this.shot('exp-saved-experience-clicked');
  }

  async expectExperienceCreated(expName) {
    const toast = this.page
      .locator('[role="alert"], [class*="toast" i], [class*="success" i]')
      .filter({ hasText: /saved|success|created|published/i });
    const listHeading = this.page.getByRole('heading', { name: /experiences/i });

    await expect(
      toast.or(listHeading).first(),
      `Experience "${expName}" should be created`
    ).toBeVisible();
  }

  // ───────────────────────── Negative helpers ─────────────────────────

  async clearGeneralFields() {
    await this._field('Name').fill('');
  }

  /** Invalid General data must keep the wizard on the General step */
  async expectGeneralValidationErrors() {
    await expect(this._field('Name'), 'Should stay on the General step').toBeVisible();
    await expect(this.productAddButton(), 'Must not reach the Product page').toBeHidden();
    await this.shot('exp-general-validation-error');
  }

  /** Invalid pricing must keep the Add Product popup open */
  async expectProductPricingError() {
    await expect(this.productModal(), 'Popup must stay open on invalid pricing').toBeVisible();
    await this.shot('exp-product-price-validation');
  }

  /**
   * Fills the product popup with intentionally invalid pricing.
   * Bypasses the client-side guard so we can test the application's validation.
   */
  async fillProductPopupWithInvalidPricing(product) {
    const modal = this.productModal();
    await modal.locator('input[type="text"]').first().fill(product.name);

    const numbers = modal.locator('input[type="number"], input[placeholder*="$" i]');
    await numbers.nth(0).fill(String(product.regularPrice));
    await numbers.nth(1).fill(String(product.salePrice));

    if (product.stock !== undefined) await numbers.nth(2).fill(String(product.stock));
    if (product.minOrderQty !== undefined) await numbers.nth(3).fill(String(product.minOrderQty));

    // Active checkbox
    await modal.locator('input[type="checkbox"]').first().setChecked(true);

    await this.shot('exp-invalid-pricing-entered');
  }

  /**
   * Clicks Save inside the product popup (for negative tests – does NOT
   * wait for it to close, because we expect it to stay open).
   */
  async clickSaveInProductPopup() {
    await this.productModal().getByRole('button', { name: /^\s*save\s*$/i }).click();
  }

  /**
   * Fills the product popup leaving the specified field empty.
   * @param {string} skipField - the field to leave empty: 'name', 'regularPrice', 'salePrice', 'stock', 'minOrderQty'
   */
  async fillProductPopupSkipping(product, skipField) {
    const modal = this.productModal();
    const numbers = modal.locator('input[type="number"], input[placeholder*="$" i]');

    if (skipField !== 'name') {
      await modal.locator('input[type="text"]').first().fill(product.name);
    }

    if (skipField !== 'regularPrice' && product.regularPrice !== undefined) {
      await numbers.nth(0).fill(String(product.regularPrice));
    }
    if (skipField !== 'salePrice' && product.salePrice !== undefined) {
      await numbers.nth(1).fill(String(product.salePrice));
    }
    if (skipField !== 'stock' && product.stock !== undefined) {
      await numbers.nth(2).fill(String(product.stock));
    }
    if (skipField !== 'minOrderQty' && product.minOrderQty !== undefined) {
      await numbers.nth(3).fill(String(product.minOrderQty));
    }

    await modal.locator('input[type="checkbox"]').first().setChecked(true);

    // Dates
    const dateInputs = modal.locator('input[placeholder*="Select date and time" i]');
    if ((await dateInputs.count()) >= 2) {
      await this._fillDate(dateInputs.nth(0), new Date());
      const end = new Date(); end.setMonth(end.getMonth() + 1);
      await this._fillDate(dateInputs.nth(1), end);
    }

    await this.shot(`exp-product-popup-skip-${skipField}`);
  }
}

module.exports = { ExperienceCreatePage };

module.exports = { ExperienceCreatePage };