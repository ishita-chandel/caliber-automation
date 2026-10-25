const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const cfg = require('../../utils/config');

/**
 * Page Object: Range Admin > Settings > Staff
 *
 * Flow:
 * 1. Navigate to Settings -> Staff (/settings/staff)
 * 2. Click "Add" button to open Add Staff page (/settings/staff/create)
 * 3. Search Existing Customer by email or mobile number
 * 4. Select the customer from the dropdown
 * 5. Select a Role from the Role dropdown
 * 6. Save and verify staff listing and details
 */
class StaffPage extends BasePage {
  // ───────────────────────── Locators ─────────────────────────

  staffCards() {
    return this.page.locator('.main-content, main, [class*="content" i]').locator('div').filter({ has: this.page.locator('a[href*="mailto:"], button, svg') });
  }

  addButton() {
    return this.page
      .locator('a[href*="/settings/staff/create"], button:has-text("Add"), a:has-text("Add")')
      .first();
  }

  searchCustomerInput() {
    return this.page.getByPlaceholder('Search by email or phone number');
  }

  selectRoleInput() {
    return this.page.getByPlaceholder('Select Role');
  }

  saveButton() {
    return this.page.getByRole('button', { name: /^save$/i });
  }

  cancelButton() {
    return this.page.getByRole('button', { name: /^cancel$/i });
  }

  roleValidationError() {
    return this.page.locator('text=At least one role is required');
  }

  noOptionsAvailable() {
    return this.page.locator('.notFound').or(this.page.getByText('No Options Available'));
  }

  // ───────────────────────── Navigation ─────────────────────────

  async navigateViaMenu() {
    await this.waitReady();
    // Navigate via Settings in the UI menu if visible
    const settingsMenu = this.page.locator('aside, nav, .sidebar').locator('text=Settings').first();
    if (await settingsMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsMenu.click();
      await this.page.waitForTimeout(300);
      const staffLink = this.page.locator('aside, nav, .sidebar').locator('a[href*="/settings/staff"], :text-is("Staff")').first();
      if (await staffLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await staffLink.click();
      } else {
        const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
        await this.goto(`${baseUrl}/settings/staff`);
      }
    } else {
      const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
      await this.goto(`${baseUrl}/settings/staff`);
    }

    await this.page.waitForLoadState('domcontentloaded');
    await this.waitReady();
    await expect(this.page).toHaveURL(/.*\/settings\/staff/);
  }

  async clickAdd() {
    await this.waitReady();
    await expect(this.addButton()).toBeVisible({ timeout: 10000 });
    await this.addButton().click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitReady();
    await expect(this.page).toHaveURL(/.*\/settings\/staff\/create/);
    await expect(this.searchCustomerInput()).toBeVisible({ timeout: 10000 });
  }

  // ───────────────────────── Customer Selection ─────────────────────────

  /**
   * Searches for a customer by email or phone and waits for the search API response.
   * Uses real keyboard events (page.keyboard.type) to trigger the debounced search handler.
   */
  async searchCustomer(query) {
    await this.waitReady();
    const input = this.searchCustomerInput();

    // Clear existing value
    await input.click({ force: true });
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Delete');
    await this.page.waitForTimeout(300);

    const searchResponsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/users') && resp.status() === 200,
      { timeout: 12000 }
    ).catch(() => null);

    // Type character-by-character to fire keyboard events and trigger debounced API
    await this.page.keyboard.type(query, { delay: 80 });

    const response = await searchResponsePromise;
    let data = [];
    if (response) {
      try {
        const json = await response.json();
        data = json?.data?.data || [];
      } catch (e) {}
    }
    await this.page.waitForTimeout(500);
    return data;
  }

  /**
   * Selects a customer from the search dropdown by name or text.
   */
  async selectCustomerFromDropdown(customerText) {
    const item = this.page.locator('li.option').filter({ hasText: customerText }).first();
    await expect(item).toBeVisible({ timeout: 5000 });
    await item.click();
    await this.page.waitForTimeout(300);

    // Dismiss any remaining customer dropdown overlay by clicking neutral header
    await this.page.locator('h6:has-text("Search Existing Customer")').click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Verifies that the customer is selected and displayed as a pill in the search area.
   */
  async verifyCustomerSelected(customerName) {
    const pill = this.page.locator('div, span').filter({ hasText: new RegExp(customerName, 'i') }).first();
    await expect(pill).toBeVisible({ timeout: 5000 });
  }

  // ───────────────────────── Role Selection ─────────────────────────

  /**
   * Opens the Role dropdown and selects the specified role name.
   */
  async selectRole(roleName = 'Staff') {
    await this.waitReady();
    const roleInput = this.selectRoleInput();
    await roleInput.click({ force: true });
    await this.page.waitForTimeout(400);

    const roleOption = this.page.locator('li.option').filter({ hasText: new RegExp(`^${roleName}$`, 'i') }).first();
    if (await roleOption.isVisible()) {
      await roleOption.click();
    } else {
      // Fallback: pick the standard 'Staff' role
      const defaultStaff = this.page.locator('li.option').filter({ hasText: /^Staff$/ }).first();
      await defaultStaff.click();
    }
    await this.page.waitForTimeout(300);

    // Dismiss role dropdown overlay by clicking neutral area
    await this.page.locator('h6:has-text("Search Existing Customer")').click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Verifies that the role is selected and displayed as a pill.
   */
  async verifyRoleSelected(roleName = 'Staff') {
    const pill = this.page.locator('div, span').filter({ hasText: new RegExp(roleName, 'i') }).first();
    await expect(pill).toBeVisible({ timeout: 5000 });
  }

  // ───────────────────────── Save Action ─────────────────────────

  async clickSave() {
    await this.waitReady();
    await this.saveButton().click({ force: true });
  }

  async saveAndExpectSuccess() {
    await this.waitReady();
    const assignResponsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/roles/assign') && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => null);

    await this.clickSave();
    await assignResponsePromise;
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitReady();

    // Verify redirection back to staff listing
    await expect(this.page).toHaveURL(/.*\/settings\/staff(\?.*)?$/, { timeout: 15000 });
  }

  // ───────────────────────── Staff Listing Verifications ─────────────────────────

  /**
   * Verifies that a staff member with the given email appears in the Staff listing.
   */
  async verifyStaffInListing(email, expectedRole = null) {
    await this.waitReady();
    const staffCard = this.page.locator('div').filter({ hasText: email }).last();
    await expect(staffCard).toBeVisible({ timeout: 15000 });

    if (expectedRole) {
      await expect(staffCard).toContainText(new RegExp(expectedRole, 'i'));
    }
    return staffCard;
  }

  /**
   * Verifies that only one entry exists for this email in the listing.
   */
  async verifySingleStaffRecord(email) {
    await this.waitReady();
    const matchingCards = this.page.locator(`text="${email}"`);
    const count = await matchingCards.count();
    expect(count).toBe(1);
  }

  /**
   * Removes/deletes a staff record from the listing if present.
   */
  async removeStaffIfExists(email) {
    await this.waitReady();
    const card = this.page.locator('.col-xl-4, .col-lg-4, .staff-card, div').filter({ has: this.page.locator(`text=${email}`) }).last();
    if (await card.isVisible({ timeout: 4000 }).catch(() => false)) {
      const deleteIcon = card.locator('img[src*="delete"], img[alt="Delete"]').first();
      if (await deleteIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        await deleteIcon.click();
        const modal = this.page.locator('#deleteModal');
        await expect(modal).toBeVisible({ timeout: 5000 });
        const confirmBtn = modal.locator('button:has-text("Delete"), button:has-text("Yes"), button.btn-danger').first();
        await confirmBtn.click();
        await this.page.waitForTimeout(2000);
      }
    }
  }
}

module.exports = { StaffPage };

