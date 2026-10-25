const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const cfg = require('../../utils/config');

/**
 * Page Object: Range Admin > Settings > Instructor
 *
 * Flow:
 * 1. Navigate to Settings -> Instructor
 * 2. Click "Add" button on the Instructor list page
 * 3. In "Create Instructor" modal, click "Add New"
 * 4. Fill in instructor details (firstName, lastName, phone, email, password, dob, gender, zipcode, userType, skillLevel, bio, avatar)
 * 5. Click "Save"
 * 6. Verify modal closes, success toast / message appears, instructor is visible in the listing with correct details
 */
class InstructorPage extends BasePage {
  // ───────────────────────── Locators ─────────────────────────

  instructorModal() {
    return this.page.locator('#modalLane2');
  }

  addButton() {
    return this.page
      .locator('.main-content, main, [class*="content" i]')
      .getByRole('button', { name: /^add$/i })
      .or(this.page.locator('button:has-text("Add")'))
      .first();
  }

  addNewButton() {
    return this.instructorModal()
      .getByRole('button', { name: /add new/i })
      .or(this.page.locator('#modalLane2 button:has-text("Add New")'))
      .first();
  }

  saveButton() {
    return this.instructorModal()
      .getByRole('button', { name: /^save$/i })
      .or(this.page.locator('#modalLane2 button:has-text("Save")'))
      .first();
  }

  closeButton() {
    return this.instructorModal()
      .getByRole('button', { name: /^close$/i })
      .or(this.page.locator('#modalLane2 button:has-text("Close")'))
      .first();
  }

  // ───────────────────────── Navigation ─────────────────────────

  async navigateViaMenu() {
    await this.waitReady();

    // Check if directly navigable via URL
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/instructor`);

    // Dismiss any active overlay / spinner
    await this.page
      .locator('.overlay-main, [class*="overlay" i], [class*="loader" i], [class*="spinner" i]')
      .first()
      .waitFor({ state: 'hidden', timeout: 15000 })
      .catch(() => {});
    await this.waitReady();

    await expect(this.page, 'Should be on the Instructors page').toHaveURL(/settings\/instructor/);
    await this.shot('admin-instructor-list');
  }

  // ───────────────────────── Modal Interaction ─────────────────────────

  async clickAdd() {
    const add = this.addButton();
    await expect(add, '"Add" button should be visible on Instructor page').toBeVisible({ timeout: 10000 });
    await add.click();
    await expect(this.instructorModal(), '"Create Instructor" modal should appear').toBeVisible({ timeout: 10000 });
    await this.shot('instructor-modal-opened');
  }

  async clickAddNew() {
    const addNew = this.addNewButton();
    await expect(addNew, '"Add New" button should be visible in modal').toBeVisible({ timeout: 10000 });
    await addNew.click();
    await expect(this.instructorModal().locator('input[name="firstName"]'), 'Instructor form fields should be displayed').toBeVisible({ timeout: 10000 });
    await this.shot('instructor-form-displayed');
  }

  async _selectCustomDropdown(fieldId, value) {
    if (!value) return;
    const modal = this.instructorModal();
    const trigger = modal.locator(`button#${fieldId}, #${fieldId}`).first();
    if (await trigger.isVisible().catch(() => false)) {
      await trigger.click();
      const option = this.page
        .locator('.form-field__custom-select-dropdown li, .form-field__custom-select-item, [role="option"]')
        .filter({ hasText: new RegExp(`^\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i') })
        .first();
      await option.waitFor({ state: 'visible', timeout: 5000 });
      await option.click();
    } else {
      // Fallback to native select if visible or evaluate
      const nativeSelect = modal.locator(`select[name="${fieldId}"]`);
      if (await nativeSelect.count()) {
        await nativeSelect.evaluate((el, val) => {
          for (let opt of el.options) {
            if (opt.text.toLowerCase().includes(val.toLowerCase()) || opt.value.toLowerCase() === val.toLowerCase()) {
              el.value = opt.value;
              el.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }, value);
      }
    }
  }

  /**
   * Fills all instructor form fields inside modalLane2
   */
  async fillInstructorDetails(data) {
    const modal = this.instructorModal();

    // 1. First Name
    if (data.firstName !== undefined) {
      const firstNameInput = modal.locator('input[name="firstName"]');
      await firstNameInput.fill(data.firstName);
    }

    // 2. Last Name
    if (data.lastName !== undefined) {
      const lastNameInput = modal.locator('input[name="lastName"]');
      await lastNameInput.fill(data.lastName);
    }

    // 3. Phone
    if (data.phone !== undefined) {
      const phoneInput = modal.locator('input[type="tel"]');
      if (await phoneInput.isVisible().catch(() => false)) {
        await phoneInput.fill(data.phone);
      }
    }

    // 4. Email
    if (data.email !== undefined) {
      const emailInput = modal.locator('input[name="email"]');
      await emailInput.fill(data.email);
    }

    // 5. Password
    if (data.password !== undefined) {
      const passwordInput = modal.locator('input[name="password"]');
      await passwordInput.fill(data.password);
    }

    // 6. Date of Birth
    if (data.dateOfBirth !== undefined) {
      const dobInput = modal.locator('input[name="dob"]');
      let formattedDob = data.dateOfBirth;
      if (formattedDob.includes('/')) {
        const parts = formattedDob.split('/');
        if (parts.length === 3) {
          formattedDob = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }
      await dobInput.fill(formattedDob);
    }

    // 7. Gender dropdown
    if (data.gender !== undefined) {
      await this._selectCustomDropdown('gender', data.gender);
    }

    // 8. Zip Code
    if (data.zipCode !== undefined) {
      const zipInput = modal.locator('input[name="zipcode"]');
      await zipInput.fill(String(data.zipCode));
    }

    // 9. Type (userType: Staff / Rover)
    if (data.type !== undefined) {
      await this._selectCustomDropdown('userType', data.type);
    }

    // 10. Skill level
    if (data.skillLevel !== undefined) {
      await this._selectCustomDropdown('skillLevel', data.skillLevel);
    }

    // 11. Bio (optional)
    if (data.bio) {
      const bioTextarea = modal.locator('textarea[name="bio"]');
      if (await bioTextarea.isVisible().catch(() => false)) {
        await bioTextarea.fill(data.bio);
      }
    }

    // 12. Avatar (optional)
    if (data.avatar) {
      const avatarInput = modal.locator('input[type="file"]');
      if (await avatarInput.isVisible().catch(() => false)) {
        await avatarInput.setInputFiles(data.avatar);
      }
    }

    await this.shot('instructor-form-filled');
  }

  async clickSave() {
    const save = this.saveButton();
    await expect(save, 'Save button should be visible in modal').toBeVisible({ timeout: 10000 });
    await save.click();
  }

  async saveAndExpectSuccess() {
    await this.clickSave();
    // Modal should close upon successful creation
    await expect(this.instructorModal(), 'Instructor modal should close after successful save').toBeHidden({ timeout: 15000 });
    await this.page
      .locator('.overlay-main, [class*="overlay" i], [class*="loader" i]')
      .first()
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => {});
    await this.waitReady();
    await this.shot('instructor-saved-success');
  }

  // ───────────────────────── Assertions ─────────────────────────

  /**
   * Verifies that the instructor is listed in the instructors table
   */
  async verifyInstructorInList(fullNameOrEmail) {
    const searchInput = this.page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(fullNameOrEmail);
      await this.page.waitForTimeout(500);
    }

    const row = this.page
      .locator('table tbody tr')
      .filter({ hasText: fullNameOrEmail })
      .first();

    await expect(row, `Instructor "${fullNameOrEmail}" should appear in the listing`).toBeVisible({ timeout: 15000 });
    await this.shot('instructor-verified-in-list');
  }

  /**
   * Verifies instructor row details (name, email, skill level / details)
   */
  async verifyInstructorRowDetails({ fullName, email, skillLevel }) {
    const table = this.page.locator('table tbody');
    if (email) {
      await expect(table.locator(`td[data-label="Email"]:has-text("${email}")`).first(), `Email "${email}" should appear in listing`).toBeVisible({ timeout: 10000 });
    }
    if (fullName) {
      // The Name cell contains a visible span / text with the instructor name or truncated text
      const firstName = fullName.split(' ')[0];
      await expect(table.locator(`td[data-label="Name"]:has-text("${firstName}")`).first(), `Name starting with "${firstName}" should appear in listing`).toBeVisible({ timeout: 10000 });
    }
    if (skillLevel) {
      const skillRegex = new RegExp(skillLevel.split('/')[0].trim(), 'i');
      await expect(table.locator('td').filter({ hasText: skillRegex }).first(), `Skill Level "${skillLevel}" should be reflected in listing`).toBeVisible({ timeout: 10000 });
    }
  }

  /**
   * Confirms the instructor is NOT in the listing
   */
  async expectInstructorNotInList(identifier) {
    const searchInput = this.page.locator('input[type="search"], input[placeholder*="search" i]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill(identifier);
      await this.page.waitForTimeout(500);
    }

    const item = this.page.getByText(identifier, { exact: true });
    await expect(item, `Instructor "${identifier}" should not exist in the listing`).toHaveCount(0);
  }

  /**
   * Negative assertion: asserts that validation prevented submission and the modal remains open
   */
  async expectValidationError() {
    // 1. Modal must stay open
    await expect(this.instructorModal(), 'Modal should remain open on validation failure').toBeVisible({ timeout: 5000 });

    // 2. Either an HTML5 validation message exists or a visible text error / feedback class is shown
    const hasInvalid = await this.instructorModal().locator(':invalid, .invalid-feedback, [class*="error" i], .text-danger').count();
    expect(hasInvalid, 'Validation error indicator or invalid input must be present').toBeGreaterThan(0);

    await this.shot('instructor-validation-error');
  }
}

module.exports = { InstructorPage };
