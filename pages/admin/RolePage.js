const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const cfg = require('../../utils/config');

/**
 * Page Object: Range Admin > Settings > Roles
 *
 * Flow:
 * 1. Navigate to Settings -> Roles (/settings/roles)
 * 2. Click "Add" button to open Create Role page (/settings/roles/create)
 * 3. Enter unique role name and click "Create Role"
 * 4. Configure permissions:
 *    - Set "General Settings" to "Full Access"
 *    - Ensure all other modules remain at "No Access" (including clearing Range Settings default if present)
 * 5. Click "Save"
 * 6. Verify redirection to Roles listing page
 * 7. Verify the newly created role is visible in the listing
 * 8. Verify persisted permissions (by viewing / reopening role details)
 */
class RolePage extends BasePage {
  // ───────────────────────── Locators ─────────────────────────

  rolesTable() {
    return this.page.locator('table tbody tr');
  }

  addButton() {
    return this.page
      .locator('a[href*="/settings/roles/create"], button:has-text("Add"), a:has-text("Add")')
      .first();
  }

  roleNameInput() {
    return this.page.getByPlaceholder('e.g. Range Staff, Instructor');
  }

  createRoleStepButton() {
    return this.page.getByRole('button', { name: /^create role$/i }).first();
  }

  saveButton() {
    return this.page.getByRole('button', { name: /^save$/i }).or(this.page.locator('button:has-text("Save")')).first();
  }

  // ───────────────────────── Navigation ─────────────────────────

  async navigateViaMenu() {
    await this.waitReady();
    // Navigate via Settings in the UI menu if visible
    const settingsMenu = this.page.locator('aside, nav, .sidebar').locator('text=Settings').first();
    if (await settingsMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsMenu.click();
      await this.page.waitForTimeout(300);
      const rolesLink = this.page.locator('aside, nav, .sidebar').locator('a[href*="/settings/roles"], :text-is("Roles")').first();
      if (await rolesLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await rolesLink.click();
      } else {
        const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
        await this.goto(`${baseUrl}/settings/roles`);
      }
    } else {
      const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
      await this.goto(`${baseUrl}/settings/roles`);
    }

    await this.page.waitForLoadState('domcontentloaded');
    await this.waitReady();
    await expect(this.page).toHaveURL(/.*\/settings\/roles/);
  }

  async clickAdd() {
    await this.waitReady();
    await expect(this.addButton()).toBeVisible({ timeout: 10000 });
    await this.addButton().click();
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitReady();
    await expect(this.page).toHaveURL(/.*\/settings\/roles\/create/);
    await expect(this.roleNameInput()).toBeVisible({ timeout: 10000 });
  }

  // ───────────────────────── Step 1: Role Name ─────────────────────────

  async enterRoleName(name) {
    await this.roleNameInput().fill(name);
    await expect(this.roleNameInput()).toHaveValue(name);
    await this.createRoleStepButton().click();
    await this.waitReady();
    // Wait for the permissions configuration section to appear
    await expect(this.page.locator('text=Administration').first()).toBeVisible({ timeout: 10000 });
  }

  // ───────────────────────── Step 2: Permissions Configuration ─────────────────────────

  /**
   * Helper to locate module row across potential classnames or text structures
   */
  getModuleRow(moduleName) {
    return this.page
      .locator('.permission-dropdown-module-row, [class*="module-row"], tr, div')
      .filter({ has: this.page.locator(`.permission-dropdown-module-name:has-text("${moduleName}"), span:has-text("${moduleName}"), div:has-text("${moduleName}")`) })
      .filter({ hasText: moduleName })
      .first();
  }

  /**
   * Configures General Settings to Full Access, and ensures all other modules are at No Access.
   */
  async configurePermissionsGeneralSettingsFullAccessOnly() {
    await this.waitReady();

    // 1. In Caliber Card Range Admin, the system defaults "Range Settings" to View.
    // If the cross icon on Range Settings' "View" pill is clicked, let's remove it if interactable:
    const rangeSettingsViewPill = this.page.locator('div, span, generic').filter({ hasText: /^View$/ }).first();
    const closeIcon = rangeSettingsViewPill.locator('..').locator('img, svg, button').first();
    if (await closeIcon.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeIcon.click({ force: true });
      await this.page.waitForTimeout(400);
    }

    // 2. Locate General Settings row
    const genSettingsRow = this.page.locator('div, tr').filter({ hasText: /^General Settings/ }).first();
    await expect(genSettingsRow).toBeVisible({ timeout: 10000 });

    // 3. Open dropdown for General Settings by clicking its input / control
    const dropdownInput = genSettingsRow.getByRole('textbox').first();
    await dropdownInput.click();
    await this.page.waitForTimeout(400);

    // 4. In page snapshot, genSettingsRow contains:
    // list > listitem > checkbox + text "Full Access"
    // Click the checkbox directly inside genSettingsRow
    const fullAccessCheckbox = genSettingsRow.getByRole('checkbox').first();
    if (await fullAccessCheckbox.count() > 0) {
      await fullAccessCheckbox.click({ force: true });
    } else {
      const fullAccessOption = genSettingsRow.locator('li, [role="option"]').filter({ hasText: /^Full Access$/i }).first();
      await fullAccessOption.click({ force: true });
    }
    await this.page.waitForTimeout(400);

    // Close dropdown by pressing Escape
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    // 5. Confirm General Settings row visibly displays "Full Access"
    await expect(genSettingsRow).toContainText(/full access/i);
  }

  // ───────────────────────── Save Role ─────────────────────────

  async saveRole() {
    await this.waitReady();
    await expect(this.saveButton()).toBeVisible({ timeout: 10000 });

    // Wait for save API response
    const saveResponsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/roles') && (resp.status() === 200 || resp.status() === 201),
      { timeout: 15000 }
    ).catch(() => null);

    await this.saveButton().click();

    await saveResponsePromise;
    await this.page.waitForLoadState('domcontentloaded');
    await this.waitReady();

    // Verify navigation back to roles list
    await expect(this.page).toHaveURL(/.*\/settings\/roles(\?.*)?$/, { timeout: 15000 });
  }

  // ───────────────────────── Verifications ─────────────────────────

  async verifyRoleInList(roleName) {
    await this.waitReady();
    // Role names might be visually truncated in table cell with ellipsis, e.g. "Staff QA 5995..."
    // Match by prefix or full name
    const prefix = roleName.slice(0, 12);
    const roleRow = this.rolesTable().filter({ hasText: prefix }).first();
    await expect(roleRow).toBeVisible({ timeout: 15000 });
    return roleRow;
  }

  async verifyRolePermissionsPersisted(roleName) {
    await this.waitReady();
    const prefix = roleName.slice(0, 12);
    const roleRow = this.rolesTable().filter({ hasText: prefix }).first();
    await expect(roleRow).toBeVisible({ timeout: 10000 });

    // In the listing, permissions are shown as badges/pills in the Permissions column
    // Verify General Settings permissions are present
    await expect(roleRow).toContainText(/General Settings/i);

    // Click the Edit / View Permissions action button to open the details modal: "Permissions - Staff QA ..."
    const actionBtn = roleRow.getByRole('button').first();
    await expect(actionBtn).toBeVisible({ timeout: 5000 });
    await actionBtn.click();
    await this.page.waitForTimeout(500);

    // Locate the modal dialog or container
    const modalHeading = this.page.getByRole('heading', { name: new RegExp(`Permissions - ${prefix}`, 'i') });
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // The modal dialog contains the header and the body
    const modalContainer = modalHeading.locator('../..');

    // Verify General Settings permissions: View, Create, Edit, Delete
    await expect(modalContainer).toContainText(/General Settings/i);
    await expect(modalContainer).toContainText(/View/i);
    await expect(modalContainer).toContainText(/Create/i);
    await expect(modalContainer).toContainText(/Edit/i);
    await expect(modalContainer).toContainText(/Delete/i);

    // Verify other modules (Roles, POS Devices, Bays, etc.) have no permissions granted in modal
    await expect(modalContainer).not.toContainText(/Roles/);
    await expect(modalContainer).not.toContainText(/Point of Sale/);
    await expect(modalContainer).not.toContainText(/Bays/);
    await expect(modalContainer).not.toContainText(/Lanes/);

    // Close modal
    const closeBtn = modalHeading.locator('..').getByRole('button').or(this.page.getByRole('button', { name: /^x$/i })).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await this.page.keyboard.press('Escape');
    }
  }
}

module.exports = { RolePage };

