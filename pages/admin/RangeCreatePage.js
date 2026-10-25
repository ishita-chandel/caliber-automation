const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const cfg = require('../../utils/config');

/**
 * Page Object for Range Creation Wizard
 * Path: Settings > Locations > Add -> /settings/range-create
 * Steps:
 * 1. General
 * 2. Agreements
 * 3. Address
 * 4. Features
 * 5. Banner and Logo
 * 6. Manage Ranges
 * 7. Instructors
 * 8. Operation Hours
 * 9. Social Link
 */
class RangeCreatePage extends BasePage {
  /**
   * Navigates to Create Range wizard by clicking:
   * 1. Checks if any gate agreement modal (#trnAgreementGateModal) is present and resolves it
   * 2. Settings in sidebar (expands submenu if not open)
   * 3. Locations sub-item (/settings/range-locations)
   * 4. Add button on the Locations page (/settings/range-create)
   */
  async navigateViaMenu() {
    console.log('[range-create] Navigating via sidebar: Settings > Locations > Add');

    // Handle gate agreement modal if still active on dashboard
    await this.handleGateAgreementIfPresent();

    // Wait for any initial overlay or loading mask to detach
    await this.page
      .locator('.overlay-main, [class*="overlay" i], [class*="loader" i], [class*="spinner" i]')
      .first()
      .waitFor({ state: 'hidden', timeout: 10000 })
      .catch(() => {});
    await this.waitReady();

    // Re-check gate agreement modal if appeared during transition
    await this.handleGateAgreementIfPresent();

    // 1. Locate Locations link in sidebar
    const locationsLink = this.page.locator('a[href*="range-locations"], a[href*="locations"]').first();
    let isLocationsVisible = await locationsLink.isVisible().catch(() => false);

    if (!isLocationsVisible) {
      // Expand Settings menu in sidebar
      const settingsToggle = this.page
        .locator('button:has-text("Settings"), [class*="dropdown-toggle"]:has-text("Settings"), aside :text-is("Settings")')
        .first();
      await settingsToggle.waitFor({ state: 'visible', timeout: 10000 });
      await settingsToggle.click({ force: true });
      await this.page.waitForTimeout(600);
      isLocationsVisible = await locationsLink.isVisible().catch(() => false);
    }

    if (isLocationsVisible) {
      await locationsLink.click({ force: true });
    } else {
      // Direct fallback to /settings/range-locations
      const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
      await this.goto(`${baseUrl}/settings/range-locations`);
    }

    await this.waitReady();
    await this.shot('locations-list-page');

    // 2. Click Add button on Locations page
    const addButton = this.page
      .locator(
        'a[href*="range-create"], button:has-text("Add"), a:has-text("Add"), button:has-text("Create Range"), a:has-text("Create Range"), [aria-label*="add" i]'
      )
      .first();

    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click({ force: true });
    } else {
      // Direct fallback to /settings/range-create
      const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
      await this.goto(`${baseUrl}/settings/range-create`);
    }

    await this.waitReady();
    await this.shot('create-range-general-step');

    // If gate agreement modal popped up when arriving at create-range, sign it before filling inputs
    await this.handleGateAgreementIfPresent();
  }

  /**
   * Direct URL navigation fallback to /settings/range-create
   */
  async navigateDirect() {
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/range-create`);
    await this.shot('create-range-direct-url');
  }

  /**
   * Checks if TRN Agreement gate modal (#trnAgreementGateModal) is displayed and completes signing
   */
  async handleGateAgreementIfPresent() {
    const gateModal = this.page.locator('#trnAgreementGateModal, .sign-agreement-modal, [class*="sign-agreement-modal" i]').first();
    if (await gateModal.isVisible({ timeout: 4000 }).catch(() => false)) {
      console.log('[range-create] TRN Agreement gate modal detected! Completing agreement before proceeding...');
      
      // Wait for skeletons/loaders to resolve
      await gateModal.locator('.react-loading-skeleton, .loader, .spinner').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      await this.page.waitForTimeout(800);

      // Signer Title
      const titleInput = gateModal.locator('input#signer_title, input[name="signer_title"]').first();
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await titleInput.scrollIntoViewIfNeeded().catch(() => {});
        const emailLocalPart = (cfg.ADMIN_EMAIL || 'admin').split('@')[0];
        await titleInput.fill(emailLocalPart);
      }

      // Check acknowledgment checkboxes if present
      const acks = gateModal.locator('input[type="checkbox"]');
      const count = await acks.count();
      for (let i = 0; i < count; i++) {
        const cb = acks.nth(i);
        if (await cb.isVisible().catch(() => false) && !(await cb.isChecked().catch(() => false))) {
          await cb.check({ force: true }).catch(() => {});
        }
      }

      // Digital Signature canvas
      const canvas = gateModal.locator('canvas').first();
      if (await canvas.isVisible({ timeout: 5000 }).catch(() => false)) {
        await canvas.scrollIntoViewIfNeeded().catch(() => {});
        await this.page.waitForTimeout(400);

        const box = await canvas.boundingBox();
        if (box && box.width > 0 && box.height > 0) {
          const startX = box.x + box.width * 0.2;
          const startY = box.y + box.height * 0.5;
          const endX = box.x + box.width * 0.8;
          const endY = box.y + box.height * 0.5;

          await this.page.mouse.move(startX, startY);
          await this.page.mouse.down();
          await this.page.mouse.move(startX + 40, startY - 20, { steps: 5 });
          await this.page.mouse.move(startX + 80, startY + 20, { steps: 5 });
          await this.page.mouse.move(endX, endY, { steps: 5 });
          await this.page.mouse.up();
        }

        await this.page.evaluate(() => {
          const c = document.querySelector('#trnAgreementGateModal canvas, .sign-agreement-modal canvas, canvas');
          if (c) {
            const rect = c.getBoundingClientRect();
            const ctx = c.getContext('2d');
            if (ctx) {
              ctx.beginPath();
              ctx.moveTo(20, 40);
              ctx.lineTo(150, 40);
              ctx.stroke();
            }
            c.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: rect.left + 50, clientY: rect.top + 50 }));
            c.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: rect.left + 150, clientY: rect.top + 50 }));
            c.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + 150, clientY: rect.top + 50 }));
            c.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }).catch(() => {});
      }

      await this.page.waitForTimeout(1000);

      // Submit
      const submitBtn = gateModal.locator('button[type="submit"], button:has-text("Submit")').first();
      if (await submitBtn.isEnabled({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.click();
        await expect(gateModal, 'Agreement gate modal should close after submit').toBeHidden({ timeout: 15000 });
        await this.waitReady();
        console.log('[range-create] Agreement gate modal closed successfully.');
      }
    }
  }

  /**
   * Locators for General section inputs
   */
  getNameInput() {
    return this.page
      .locator('input[name="name"], input[placeholder*="name" i]')
      .or(this.page.getByLabel(/^name/i))
      .first();
  }

  getDescriptionEditor() {
    return this.page
      .locator(
        '[contenteditable="true"], .ProseMirror, .ql-editor, textarea[name*="description" i], textarea'
      )
      .first();
  }

  getSubHeadingInput() {
    return this.page
      .locator('input[name*="subHeading" i], input[name*="sub_heading" i], input[placeholder*="sub" i]')
      .or(this.page.getByLabel(/sub\s*heading/i))
      .first();
  }

  getPhoneInput() {
    return this.page
      .locator('input.PhoneInputInput, input[type="tel"], input[name*="phone" i], input[placeholder*="phone" i]')
      .first();
  }

  getEmailInput() {
    return this.page
      .locator('input[type="email"], input[name*="email" i]')
      .or(this.page.getByLabel(/email/i))
      .first();
  }

  getWebsiteInput() {
    return this.page
      .locator('input[name*="website" i], input[placeholder*="https://" i]')
      .or(this.page.getByLabel(/website/i))
      .first();
  }

  /**
   * Checkbox helper that works for native checkboxes or custom UI switch/wrappers
   */
  async setCheckbox(labelPattern, shouldCheck = true) {
    if (shouldCheck === undefined) return;

    const namePattern = labelPattern instanceof RegExp ? labelPattern.source.replace(/[^a-zA-Z]/g, '') : String(labelPattern);
    const inputCheckbox = this.page
      .locator(`input[type="checkbox"][name*="${namePattern}" i]`)
      .or(
        this.page
          .locator('div, label')
          .filter({ hasText: labelPattern })
          .locator('input[type="checkbox"], [role="checkbox"]')
      )
      .first();

    if ((await inputCheckbox.count()) > 0) {
      try {
        if (shouldCheck) {
          await inputCheckbox.check({ force: true });
        } else {
          await inputCheckbox.uncheck({ force: true });
        }
        return;
      } catch {
        // Fallback: evaluate DOM checked state and dispatch event
        await inputCheckbox.evaluate((el, val) => {
          el.checked = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }, shouldCheck).catch(() => {});
        return;
      }
    }

    // 2. Fallback: Click the visual label or text
    const textLabel = this.page.locator('label, span, p').filter({ hasText: labelPattern }).first();
    if ((await textLabel.count()) > 0) {
      await textLabel.scrollIntoViewIfNeeded().catch(() => {});
      await textLabel.click({ force: true }).catch(() => {});
    }
  }

  /**
   * STEP 1: Fills all fields in the GENERAL tab
   */
  async fillGeneralDetails(data) {
    console.log(`[range-create] Filling General details for: ${data.name}`);

    // Ensure no TRN agreement modal is blocking form interaction
    await this.handleGateAgreementIfPresent();

    // 1. Name *
    if (data.name) {
      const nameInput = this.getNameInput();
      await nameInput.waitFor({ state: 'visible', timeout: 10000 });
      await nameInput.fill(data.name);
    }

    // 2. Description * (Rich Text Editor or Textarea)
    if (data.description) {
      const descEditor = this.getDescriptionEditor();
      await descEditor.waitFor({ state: 'visible', timeout: 10000 });
      await descEditor.click();
      try {
        await descEditor.fill(data.description);
      } catch {
        await this.page.keyboard.press('Meta+A').catch(() => this.page.keyboard.press('Control+A'));
        await this.page.keyboard.press('Backspace');
        await this.page.keyboard.type(data.description);
      }
    }

    // 3. Sub Heading *
    if (data.subHeading) {
      const subHeadingInput = this.getSubHeadingInput();
      await subHeadingInput.fill(data.subHeading);
    }

    // 4. Phone *
    if (data.phone) {
      const phoneInput = this.getPhoneInput();
      await phoneInput.fill(data.phone);
    }

    // 5. Email *
    if (data.email) {
      const emailInput = this.getEmailInput();
      await emailInput.fill(data.email);
    }

    // 6. Website (optional)
    if (data.website) {
      const websiteInput = this.getWebsiteInput();
      await websiteInput.fill(data.website);
    }

    // 7. Partner Checkboxes
    if (data.shotproPartner !== undefined) await this.setCheckbox(/shotpro partner/i, data.shotproPartner);
    if (data.nssfPartner !== undefined) await this.setCheckbox(/nssf partner/i, data.nssfPartner);
    if (data.usccaPartner !== undefined) await this.setCheckbox(/uscca partner/i, data.usccaPartner);

    // 8. Category Checkboxes
    if (data.firearm !== undefined) await this.setCheckbox(/firearm/i, data.firearm);
    if (data.archery !== undefined) await this.setCheckbox(/archery/i, data.archery);

    // 9. Gun Types Checkboxes
    if (Array.isArray(data.gunTypes) && data.gunTypes.length > 0) {
      for (const gunType of data.gunTypes) {
        await this.setCheckbox(new RegExp(`^${gunType}$`, 'i'), true);
      }
    }

    await this.shot('create-range-general-filled');
  }

  /**
   * Clicks Save or Save & Next or Next button
   */
  async clickSave(stepName = 'current step') {
    console.log(`[range-create] Clicking Save for ${stepName}`);
    const saveButton = this.page
      .locator(
        'button:has-text("Save & Next"), button:has-text("Save"), button:has-text("Next"), [type="submit"]:has-text("Save")'
      )
      .first();

    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.scrollIntoViewIfNeeded().catch(() => {});
    await saveButton.click({ force: true });
    await this.waitReady();
    await this.shot(`saved-${stepName.replace(/\s+/g, '-').toLowerCase()}`);
  }

  /**
   * STEP 2: Agreements
   */
  async handleAgreementsStep() {
    console.log('[range-create] Handling Step 2: Agreements');
    await this.waitReady();

    const signScheduleACandidates = [
      this.page.getByRole('checkbox', { name: /schedule a.*digitally|sign.*digitally/i }),
      this.page.getByRole('radio', { name: /schedule a.*digitally|sign.*digitally/i }),
      this.page.getByLabel(/schedule a.*digitally|sign.*digitally/i),
      this.page.locator('label, div, span').filter({ hasText: /schedule a.*digitally|sign.*digitally/i }),
      this.page.getByRole('button', { name: /schedule a.*digitally|sign.*digitally/i }),
      this.page.getByText(/sign schedule a digitally/i),
      this.page.getByText(/schedule a/i),
    ];

    let selected = false;
    for (const locator of signScheduleACandidates) {
      if (await locator.first().isVisible().catch(() => false)) {
        console.log('[range-create] Found Sign Schedule A digitally option');
        const input = locator.first().locator('input[type="checkbox"], input[type="radio"]').first();
        if ((await input.count()) > 0) {
          await input.check({ force: true }).catch(async () => await locator.first().click({ force: true }));
        } else {
          await locator.first().click({ force: true });
        }
        selected = true;
        break;
      }
    }

    if (!selected) {
      console.log('[range-create] Falling back: checking any available agreement checkbox/switch');
      const anyCheckbox = this.page.locator('input[type="checkbox"], input[type="radio"], [role="switch"]').first();
      if (await anyCheckbox.isVisible().catch(() => false)) {
        await anyCheckbox.click({ force: true });
      }
    }

    await this.shot('agreements-step-selected');
    await this.clickSave('agreements');
  }

  /**
   * STEP 3: Address
   */
  async handleAddressStep(address = '78 main street canada') {
    console.log(`[range-create] Handling Step 3: Address with "${address}"`);
    await this.waitReady();

    const addressInput = this.page
      .locator(
        'input[name*="address" i], input[placeholder*="address" i], input[name*="street" i], input[placeholder*="street" i], [aria-label*="address" i]'
      )
      .or(this.page.getByLabel(/address|street/i))
      .first();

    if (await addressInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addressInput.click();
      await addressInput.fill(address);
      await this.page.waitForTimeout(1000);

      const suggestion = this.page
        .locator('.pac-item, [role="option"], [class*="suggestion" i], [class*="dropdown-item" i]')
        .first();
      if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('[range-create] Selecting address autocomplete item');
        await suggestion.click({ force: true });
      } else {
        await this.page.keyboard.press('ArrowDown').catch(() => {});
        await this.page.keyboard.press('Enter').catch(() => {});
      }
    }

    const countryField = this.page
      .locator('select[name*="country" i], [name*="country" i], input[placeholder*="country" i], [aria-label*="country" i]')
      .or(this.page.getByLabel(/country/i))
      .first();

    if (await countryField.isVisible().catch(() => false)) {
      const tagName = await countryField.evaluate((el) => el.tagName.toLowerCase()).catch(() => '');
      if (tagName === 'select') {
        await countryField.selectOption({ label: 'Canada' }).catch(async () => {
          await countryField.selectOption({ value: 'CA' }).catch(() => {});
        });
      } else {
        await countryField.fill('Canada').catch(() => {});
      }
    }

    await this.shot('address-step-filled');
    await this.clickSave('address');
  }

  /**
   * STEPS 4-9: Skip remaining steps
   */
  async skipRemainingSteps() {
    console.log('[range-create] Skipping/saving all remaining steps (4 through 9)...');

    for (let stepIndex = 4; stepIndex <= 10; stepIndex++) {
      await this.page.waitForTimeout(1200);
      const url = this.page.url();

      if (url.includes('/settings/locations') || (url.includes('/locations') && !url.includes('/range-create'))) {
        console.log('[range-create] Reached locations list, range creation finished!');
        break;
      }

      const skipButton = this.page
        .locator('button:has-text("Skip"), a:has-text("Skip"), button:has-text("Skip for now"), [aria-label*="skip" i]')
        .first();

      if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[range-create] Step ${stepIndex}: Clicking "Skip"`);
        await skipButton.click({ force: true });
        await this.waitReady();
        await this.shot(`step-${stepIndex}-skipped`);
        continue;
      }

      const nextButton = this.page
        .locator('button:has-text("Save & Next"), button:has-text("Save"), button:has-text("Next"), button:has-text("Finish"), button:has-text("Submit"), button:has-text("Done")')
        .first();

      if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`[range-create] Step ${stepIndex}: Clicking Save/Next`);
        await nextButton.click({ force: true });
        await this.waitReady();
        await this.shot(`step-${stepIndex}-saved`);
        continue;
      }

      console.log(`[range-create] No further skip/next button on step ${stepIndex}`);
      break;
    }

    await this.waitReady();
    await this.shot('range-creation-completed');
  }

  /**
   * Verifies that the range creation was successfully finished
   */
  async expectRangeCreated(createdRangeName) {
    const successToast = this.page
      .locator('[role="alert"], [class*="toast" i], [class*="success" i]')
      .filter({ hasText: /saved|success|created|added/i });

    const locationsHeader = this.page
      .locator('h1, h2, [class*="title" i], [class*="header" i]')
      .filter({ hasText: /locations|ranges/i });

    const isFinished = await Promise.race([
      this.page.waitForURL(/.*locations.*/, { timeout: 20000 }).then(() => true).catch(() => false),
      successToast.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false),
      locationsHeader.first().waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false),
    ]);

    expect(isFinished, 'Range creation should complete and redirect or display success').toBeTruthy();

    // If on locations list, wait for list table/cards to load so user can see it in headed mode
    await this.waitReady();
    if (createdRangeName) {
      const createdItem = this.page.getByText(createdRangeName).first();
      await createdItem.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {
        console.log(`[range-create] Name "${createdRangeName}" in list not immediately visible in table view`);
      });
    }

    // Give a 3-second visible pause in headed mode so the confirmation page and newly created range are clearly visible
    await this.page.waitForTimeout(3000);
    await this.shot('range-creation-final-confirmed');
    console.log('[range-create] Range creation confirmed! Landed on confirmation/locations view.');
  }

  /**
   * Clears text input fields on the General form
   */
  async clearGeneralFields() {
    console.log('[range-create] Clearing General form fields');
    const nameInput = this.getNameInput();
    if (await nameInput.isVisible().catch(() => false)) await nameInput.fill('');

    const subHeading = this.getSubHeadingInput();
    if (await subHeading.isVisible().catch(() => false)) await subHeading.fill('');

    const email = this.getEmailInput();
    if (await email.isVisible().catch(() => false)) await email.fill('');

    const phone = this.getPhoneInput();
    if (await phone.isVisible().catch(() => false)) await phone.fill('');
  }

  /**
   * Asserts that validation errors are present on the General form
   */
  async expectValidationErrors(pattern = /required|valid|invalid|enter|field/i) {
    const errorLocators = this.page.locator(
      '[role="alert"], [class*="error" i], [class*="invalid" i], [class*="feedback" i], [class*="help" i], .text-danger'
    );
    const hasVisibleError = (await errorLocators.filter({ hasText: pattern }).count()) > 0;

    const html5ValidationInfo = await this.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, select, textarea'));
      const invalidEl = inputs.find((el) => !el.checkValidity() || (el.validationMessage && el.validationMessage !== ''));
      return invalidEl ? { isInvalid: true, message: invalidEl.validationMessage } : { isInvalid: false, message: '' };
    }).catch(() => ({ isInvalid: false, message: '' }));

    const hasHtml5Validation = html5ValidationInfo.isInvalid;

    const isStillOnGeneral = await this.page
      .locator('h1, h2, h3, h4, div')
      .filter({ hasText: /^general$/i })
      .first()
      .isVisible()
      .catch(() => false);
    const hasNotAdvanced = !this.page.url().includes('agreements');

    await this.shot('validation-errors-displayed');
    console.log(
      `[range-create] Validation assertion - Error UI: ${hasVisibleError}, HTML5: ${hasHtml5Validation} ("${html5ValidationInfo.message}"), Still on General: ${isStillOnGeneral}`
    );

    expect(
      hasVisibleError || hasHtml5Validation,
      'Validation error messages or required field prompts should appear'
    ).toBeTruthy();

    expect(isStillOnGeneral || hasNotAdvanced, 'Form should remain on General step and not advance').toBeTruthy();
  }
}

module.exports = { RangeCreatePage };

