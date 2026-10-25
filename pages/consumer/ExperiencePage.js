const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');

/**
 * Consumer Experience Page Object
 * Handles:
 *   - Navigation to /experience
 *   - Category filtering ("All")
 *   - Experience search & card selection ("GET TICKETS")
 *   - Product/ticket selection and quantity adjustment
 *   - "Reserve your spot" navigation to cart
 */
class ExperiencePage extends BasePage {
  constructor(page) {
    super(page);
    this.searchBox = page.getByPlaceholder('Search experiences, venues...');
    this.allFilterTab = page.locator('button.filter-btn').filter({ hasText: /^all$/i }).first();
    this.reserveSpotBtn = page.locator('button').filter({ hasText: /reserve your spot/i }).first();
  }

  /**
   * Navigate to /experience using direct URL navigation (most reliable approach).
   * Dismisses cookie banner first if it is blocking clicks.
   */
  async gotoExperiencePage() {
    // Dismiss cookie banner if present (it can block sidebar/nav clicks)
    const cookieBtn = this.page
      .locator('#cookie-accept-btn, button:has-text("Accept All"), button:has-text("Accept")')
      .first();
    if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await cookieBtn.click();
      await this.page.waitForTimeout(300);
    }

    // Always use direct navigation — sidebar click can be intercepted by overlays
    await this.page.goto('https://calibercard.yatilabs.com/experience', { waitUntil: 'domcontentloaded' });
    await this.page.waitForURL(/.*\/experience/, { timeout: 15000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /**
   * Filter experiences by clicking "All"
   * Waits for at least one experience card to appear after clicking.
   */
  async filterAll() {
    const allBtn = this.allFilterTab;
    if (await allBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await allBtn.click();
      // Wait for at least one card to appear, confirming the filter has applied
      await this.page.locator('div.event-card, [class*="event-card"]')
        .first()
        .waitFor({ state: 'visible', timeout: 10000 })
        .catch(() => {
          // Tolerate if no cards yet; search will fail loudly with a clear message
        });
    }
  }

  /**
   * Search for an Experience by exact name and click "GET TICKETS" on its scoped card
   */
  async searchAndSelectExperience(experienceName) {
    // Ensure we're on the experience page with filters applied
    await this.searchBox.waitFor({ state: 'visible', timeout: 10000 });
    await this.searchBox.fill(experienceName);
    // Wait for search to complete and cards to re-render
    await this.page.waitForTimeout(2000);

    // Locate the matching card
    const card = this.page.locator('div.event-card, [class*="event-card"]')
      .filter({ hasText: experienceName })
      .first();
    await expect(card, `Card for experience "${experienceName}" should be visible after search`).toBeVisible({ timeout: 15000 });

    // Scoped GET TICKETS link/button
    const getTicketsBtn = card.locator('a, button').filter({ hasText: /get tickets/i }).first();
    await expect(getTicketsBtn, `GET TICKETS button for "${experienceName}" should be visible`).toBeVisible({ timeout: 10000 });
    await getTicketsBtn.click();

    // Verify Experience detail page opens
    await this.page.waitForURL(/.*experience-detail.*/, { timeout: 15000 });
    await this.page.waitForLoadState('domcontentloaded');
    await expect(this.page.locator('body')).toContainText(experienceName);
  }

  /**
   * Select a product/ticket and set the desired quantity
   * @param {string} productName - Exact product name
   * @param {number} quantity - Target quantity (default: 1)
   */
  async selectProductAndQuantity(productName, quantity = 1) {
    const productRow = this.page.locator('.expd-ticket-row, [class*="ticket-row"]')
      .filter({ hasText: productName })
      .first();
    await expect(productRow, `Product row for "${productName}" should be visible`).toBeVisible({ timeout: 10000 });

    // Ensure the product row is selected (check if already selected)
    const isSelected = await productRow.evaluate(el => el.classList.contains('expd-ticket-row--selected'));
    if (!isSelected) {
      await productRow.click();
      await this.page.waitForTimeout(500);
    }

    // Set quantity using + or - buttons
    if (quantity > 1) {
      const plusBtn = this.page.locator('button').filter({ hasText: /^\+$/ }).first();
      await expect(plusBtn).toBeVisible({ timeout: 5000 });
      // Currently defaults to 1, click plus for additional quantity
      for (let i = 1; i < quantity; i++) {
        await plusBtn.click();
        await this.page.waitForTimeout(300);
      }
    }

    // Verify quantity indicator
    const qtyText = this.page.locator('.quantity-value, [class*="quantity"], .expd-qty-val').first();
    if (await qtyText.isVisible().catch(() => false)) {
      await expect(qtyText).toHaveText(String(quantity));
    }
  }

  /**
   * Click "Reserve your spot" and navigate to /cart
   */
  async clickReserveSpot() {
    await this.page.waitForLoadState('domcontentloaded');
    const btn = this.page.locator('button.expd-floating-checkout-btn').first();
    await expect(btn, '"Reserve your spot" button should be visible on experience detail page').toBeVisible({ timeout: 10000 });
    await expect(btn, '"Reserve your spot" button should be enabled').toBeEnabled({ timeout: 10000 });

    // Wait for any navigation after clicking
    await Promise.all([
      this.page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      btn.click(),
    ]);

    const currentUrl = this.page.url();
    if (!currentUrl.includes('/cart')) {
      throw new Error(
        `Expected navigation to /cart after clicking "Reserve your spot", but landed on: ${currentUrl}. ` +
        'This may indicate the user session lost membership state or the experience has no availability.'
      );
    }
    await this.page.waitForLoadState('domcontentloaded');
  }
}

module.exports = { ExperiencePage };
