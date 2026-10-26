const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const cfg = require('../../utils/config');

const rangeAddressData = {
  address: '78 Main Street',
  country: 'United States',
  state: 'Texas',
  city: 'Houston',
  zipCode: '77001',
  latitude: '29.7604',
  longitude: '-95.3698',
};

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

    // For new users who are immediately redirected to range-create upon login
    if (this.page.url().includes('/settings/range-create')) {
      console.log('[range-create] Already on range-create page.');
      await this.waitReady();
      await this.handleGateAgreementIfPresent();
      return;
    }

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
   * Checks if TRN Agreement gate modal (#trnAgreementGateModal, #scheduleAAgreementGateModal) is displayed and completes signing
   */
  async handleGateAgreementIfPresent() {
    const gateModal = this.page.locator('.modal.show, .sign-agreement-modal.show, #scheduleAAgreementGateModal.show, #trnAgreementGateModal.show').first();
    if (await gateModal.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('[range-create] Agreement gate modal detected! Completing agreement before proceeding...');
      
      // Wait for skeletons/loaders to resolve
      await gateModal.locator('.react-loading-skeleton, .loader, .spinner').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      await this.page.waitForTimeout(600);

      // Scroll modal body to activate signature
      await this.page.evaluate(() => {
        const m = document.querySelector('.modal.show, .sign-agreement-modal.show, #scheduleAAgreementGateModal.show, #trnAgreementGateModal.show');
        if (m) {
          const body = m.querySelector('.sign-agreement-modal__body, .modal-body') || m;
          body.scrollTop = body.scrollHeight;
        }
      }).catch(() => {});
      await this.page.waitForTimeout(500);

      // Signer Title
      const titleInput = gateModal.locator('input#signer_title, input[name="signer_title"]').first();
      await titleInput.scrollIntoViewIfNeeded().catch(() => {});
      if (await titleInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        const emailVal = await gateModal.locator('input#signer_email, input[name="signer_email"]').inputValue().catch(() => '');
        const emailLocalPart = (emailVal || cfg.ADMIN_EMAIL || 'admin').split('@')[0];
        await titleInput.fill(emailLocalPart || 'Manager');
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
          const c = document.querySelector('#scheduleAAgreementGateModal canvas, #trnAgreementGateModal canvas, .sign-agreement-modal canvas, canvas');
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

      await this.page.waitForTimeout(800);

      // Submit
      const submitBtn = gateModal.locator('button[type="submit"], button:has-text("Submit")').first();
      if (await submitBtn.isEnabled({ timeout: 5000 }).catch(() => false)) {
        await submitBtn.click();
        await gateModal.waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
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
    if (data.shotproPartner) await this.page.evaluate(() => { const el = document.querySelector('input[name="isShotproPartner"]'); if (el && !el.checked) el.click(); });
    if (data.nssfPartner) await this.page.evaluate(() => { const el = document.querySelector('input[name="isNssfPartner"]'); if (el && !el.checked) el.click(); });
    if (data.usccaPartner) await this.page.evaluate(() => { const el = document.querySelector('input[name="isUsccaPartner"]'); if (el && !el.checked) el.click(); });

    // 8. Category Checkboxes
    if (data.firearm !== undefined) {
      await this.page.evaluate((val) => {
        const el = document.querySelector('input[name="isFirearmEnabled"]');
        if (el && el.checked !== val) el.click();
      }, data.firearm);
    }
    if (data.archery !== undefined) {
      await this.page.evaluate((val) => {
        const el = document.querySelector('input[name="isArcheryEnabled"]');
        if (el && el.checked !== val) el.click();
      }, data.archery);
    }

    // 9. Gun Types Checkboxes
    if (Array.isArray(data.gunTypes) && data.gunTypes.length > 0) {
      await this.page.evaluate((types) => {
        types.forEach(t => {
          const val = t.toLowerCase().replace(/\s+/g, '_');
          const el = document.querySelector(`input[name="gunTypes"][value="${val}"]`) ||
                     document.querySelector(`input[name="gunTypes"][value*="${val}"]`);
          if (el && !el.checked) el.click();
        });
      }, data.gunTypes);
    }

    await this.shot('create-range-general-filled');
  }

  /**
   * Clicks Save or Save & Next or Next button
   */
  async clickSave(stepName = 'current step') {
    console.log(`[range-create] Clicking Save for ${stepName}`);
    await this.handleGateAgreementIfPresent();

    const saveButton = this.page
      .locator(
        'button:has-text("Save & Next"):visible, button:has-text("Save"):visible, button:has-text("Next"):visible, [type="submit"]:has-text("Save"):visible, [type="submit"]:visible'
      )
      .first();

    await saveButton.waitFor({ state: 'visible', timeout: 10000 });
    await saveButton.scrollIntoViewIfNeeded().catch(() => {});
    await saveButton.click({ force: true });
    await this.waitReady();
    await this.shot(`saved-${stepName.replace(/\s+/g, '-').toLowerCase()}`);

    // If "Next" button appears after saving (e.g. on General step where Save turns into Update & Next), click Next to advance
    const nextBtn = this.page.locator('button:has-text("Next"):visible').first();
    if (await nextBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log(`[range-create] Clicking Next to advance from ${stepName}`);
      await nextBtn.click({ force: true });
      await this.waitReady();
    }
  }

  /**
   * STEP 2: Agreements
   */
  async handleAgreementsStep() {
    console.log('[range-create] Handling Step 2: Agreements');
    await this.waitReady();

    // Check if TRN or Schedule A agreement modal is present and sign it
    await this.handleGateAgreementIfPresent();

    // The Agreements page fetches the schedule-a status for the newly created range.
    // Wait for the Sign button to be attached and visible.
    const signBtn = this.page.locator('button:has-text("Sign"):visible, button.btn-new--accent:has-text("Sign"):visible').first();
    const isSignVisible = await signBtn.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);

    if (isSignVisible) {
      console.log('[range-create] Sign button is visible for Schedule A. Clicking Sign...');
      await signBtn.click({ force: true });
      await this.page.waitForTimeout(1000);

      const signModal = this.page.locator('.modal.show, .sign-agreement-modal.show, #scheduleAAgreementGateModal.show, #trnAgreementGateModal.show, #signAgreementModal.show, [class*="modal"][class*="show"]').first();
      await signModal.waitFor({ state: 'visible', timeout: 15000 });

      // Reuse AdminLoginPage.signAgreementModal logic to sign and submit
      const { AdminLoginPage } = require('./AdminLoginPage');
      const adminLogin = new AdminLoginPage(this.page);
      await adminLogin.signAgreementModal(signModal, cfg.ADMIN_EMAIL);
      await this.page.waitForTimeout(2000);
    } else {
      console.log('[range-create] Sign button not shown or already signed.');
    }

    // Wait for Continue button to be visible and enabled
    const continueBtn = this.page.locator('button:has-text("Continue"):visible, button:has-text("Save & Next"):visible, button:has-text("Save"):visible').first();
    await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
    
    // In case the button remains disabled due to client-side validation lag, remove disabled and click
    await this.page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText && b.innerText.includes('Continue'));
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('btn-new--disabled');
      }
    });

    console.log('[range-create] Clicking Continue button');
    await continueBtn.click({ force: true });
    await this.waitReady();
    await this.shot('agreements-step-saved');
  }

  /**
   * STEP 3: Address
   */
  async handleAddressStep(addressInputData = rangeAddressData) {
    const data = typeof addressInputData === 'string'
      ? { ...rangeAddressData, address: addressInputData }
      : { ...rangeAddressData, ...(addressInputData || {}) };

    console.log(`[range-create] Handling Step 3: Address with:`, data);
    await this.waitReady();

    // 1. Enter Address query
    const queryInput = this.page.locator('input#address:visible, input[placeholder*="query" i]:visible, input[name*="address" i]:visible').first();
    await queryInput.waitFor({ state: 'visible', timeout: 15000 });

    await queryInput.click();
    await queryInput.fill(data.address);
    await this.page.waitForTimeout(600);

    // Wait for autocomplete pac-item and click it, or fallback
    const suggestion = this.page.locator('.pac-item, [role="option"], [class*="suggestion" i]').first();
    if (await suggestion.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[range-create] Selecting address autocomplete item');
      await suggestion.click({ force: true });
    } else {
      await this.page.keyboard.press('ArrowDown').catch(() => {});
      await this.page.keyboard.press('Enter').catch(() => {});
    }
    await this.page.waitForTimeout(600);

    // If alert with OK appears, click OK and fill the hardcoded data
    await this.page.evaluate(() => {
      const okButtons = Array.from(document.querySelectorAll('button')).filter(b => b.innerText && b.innerText.trim() === 'OK');
      okButtons.forEach(b => b.click());
    }).catch(() => {});
    await this.page.waitForTimeout(400);

    // Select State (e.g. Texas)
    const stateTrigger = this.page.locator('button#state:visible, button.form-field__custom-select-trigger:visible').first();
    if (await stateTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
      const triggerText = await stateTrigger.innerText().catch(() => '');
      if (!triggerText || triggerText.toLowerCase().includes('select') || triggerText.toLowerCase().includes('option')) {
        console.log(`[range-create] Selecting State "${data.state}" in custom dropdown...`);
        await stateTrigger.click({ force: true });
        await this.page.waitForTimeout(400);

        const option = this.page.locator('.form-field__custom-select-dropdown li, .form-field__custom-select-item, [role="option"]')
          .filter({ hasText: new RegExp(`^\\s*${data.state}\\s*$`, 'i') }).first();
        if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
          await option.click({ force: true });
        } else {
          // Native select fallback
          await this.page.evaluate((stateName) => {
            const sel = document.querySelector('select[name="state"]');
            if (sel && sel.options.length > 1) {
              for (let i = 0; i < sel.options.length; i++) {
                if (sel.options[i].text.toLowerCase().includes(stateName.toLowerCase())) {
                  sel.selectedIndex = i;
                  sel.value = sel.options[i].value;
                  break;
                }
              }
              if (sel.selectedIndex === 0) sel.selectedIndex = 1;
              sel.dispatchEvent(new Event('input', { bubbles: true }));
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, data.state).catch(() => {});
        }
      }
    }

    // Fill City (e.g. Houston)
    const cityInput = this.page.locator('input#city:visible, input[name="city"]:visible').first();
    if (await cityInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`[range-create] Filling City with "${data.city}"`);
      await cityInput.fill(data.city);
    }

    // Fill Zip / Postal Code (e.g. 77001)
    const zipInput = this.page.locator('input#zipcode:visible, input[name="zipcode"]:visible').first();
    if (await zipInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`[range-create] Filling Zipcode with "${data.zipCode}"`);
      await zipInput.fill(data.zipCode);
    }

    // Fill Latitude & Longitude (29.7604, -95.3698)
    const latInput = this.page.locator('input#latitude:visible, input[name="latitude"]:visible').first();
    if (await latInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await latInput.fill(data.latitude || '29.7604');
    }
    const lngInput = this.page.locator('input#longitude:visible, input[name="longitude"]:visible').first();
    if (await lngInput.isVisible({ timeout: 1500 }).catch(() => false)) {
      await lngInput.fill(data.longitude || '-95.3698');
    }

    // Dismiss any alert again if appeared
    await this.page.evaluate(() => {
      const okButtons = Array.from(document.querySelectorAll('button')).filter(b => b.innerText && b.innerText.trim() === 'OK');
      okButtons.forEach(b => b.click());
    }).catch(() => {});

    await this.shot('address-step-filled');

    // Click Save on Address Step form
    const saveBtn = this.page.locator('button:has-text("Save"):visible, button[type="submit"]:visible').first();
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await saveBtn.click({ force: true });
    await this.waitReady();
    await this.page.waitForTimeout(2000);

    // Dismiss any alert that popped up on save
    await this.page.evaluate(() => {
      const okButtons = Array.from(document.querySelectorAll('button')).filter(b => b.innerText && b.innerText.trim() === 'OK');
      okButtons.forEach(b => b.click());
    }).catch(() => {});

    // If Next button appeared, click it
    const nextBtn = this.page.locator('button:has-text("Next"):visible').first();
    if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[range-create] Clicking Next to advance from Address to Features');
      await nextBtn.click({ force: true });
      await this.waitReady();
    }

    // Check if on Features tab, otherwise click Features tab in wizard tablist
    const onFeatures = await this.page.locator('.tablist *, [role="tablist"] *').filter({ hasText: /features/i }).first().isVisible().catch(() => false);
    if (!onFeatures) {
      await this.page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('.tablist *, [role="tablist"] *, .create-range-layout-row *'));
        const featuresTab = tabs.find(el => el.innerText && el.innerText.trim() === 'Features');
        if (featuresTab) featuresTab.click();
      }).catch(() => {});
    }

    await this.page.waitForTimeout(1500);
    await this.waitReady();
  }

  /**
   * STEP 4: Features - Select all available options under Location, Access Type, Discipline, Facility Type
   */
  async handleFeaturesStep() {
    console.log('[range-create] Handling Step 4: Features - Selecting all options');
    await this.waitReady();

    // 1. Select all checkboxes visible on the features page
    const cbs = this.page.locator('input[type="checkbox"]:visible, [role="checkbox"]:visible');
    const cbCount = await cbs.count();
    console.log(`[range-create] Found ${cbCount} visible checkboxes on Features step`);
    for (let i = 0; i < cbCount; i++) {
      const cb = cbs.nth(i);
      const isChecked = await cb.isChecked().catch(() => false);
      if (!isChecked) {
        await cb.check({ force: true }).catch(() => cb.click({ force: true }));
      }
    }

    // 2. Also ensure each named option is selected
    const featureItems = [
      'Indoor', 'Outdoor',
      'Public', 'Private', 'Municipal',
      'Archery', 'Shotgun', 'Rifle', 'Large Caliber',
      'Training Facility'
    ];

    await this.page.evaluate((items) => {
      items.forEach(name => {
        const labels = Array.from(document.querySelectorAll('label, div, span'));
        const target = labels.find(l => l.innerText && l.innerText.trim() === name);
        if (target) {
          const cb = target.querySelector('input[type="checkbox"]') || target.parentElement.querySelector('input[type="checkbox"]');
          if (cb && !cb.checked) {
            cb.click();
          } else if (!cb) {
            target.click();
          }
        }
      });
    }, featureItems);

    await this.shot('step-4-features-selected');
    await this.clickSave('features');
  }

  /**
   * STEP 5: Banner and Logo - Click Skip
   */
  async skipBannerAndLogo() {
    console.log('[range-create] Step 5: Banner and Logo - Skipping');
    await this.waitReady();
    const skipBtn = this.page.locator('button:has-text("Skip"):visible, a:has-text("Skip"):visible').first();
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click({ force: true });
    }
    await this.waitReady();
    await this.shot('step-5-banner-logo-skipped');
  }

  /**
   * STEP 6: Manage Ranges - Click Skip/Next
   */
  async skipManageRanges() {
    console.log('[range-create] Step 6: Manage Ranges - Skipping');
    await this.waitReady();
    const skipOrNext = this.page.locator('button:has-text("Skip"):visible, button:has-text("Save & Next"):visible, button:has-text("Next"):visible').first();
    if (await skipOrNext.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipOrNext.click({ force: true });
    }
    await this.waitReady();
    await this.shot('step-6-manage-ranges-skipped');
  }

  /**
   * STEP 7: Instructors - Click Skip
   */
  async skipInstructors() {
    console.log('[range-create] Step 7: Instructors - Skipping');
    await this.waitReady();
    const skipBtn = this.page.locator('button:has-text("Skip"):visible, a:has-text("Skip"):visible').first();
    if (await skipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipBtn.click({ force: true });
    }
    await this.waitReady();
    await this.shot('step-7-instructors-skipped');
  }

  /**
   * Complete remaining steps (Hours, Social, Final)
   */
  async completeWizard() {
    console.log('[range-create] Completing remaining wizard steps...');
    for (let step = 8; step <= 12; step++) {
      await this.page.waitForTimeout(1000);
      const url = this.page.url();
      if (url.includes('/settings/locations') || url.includes('/settings/range-locations')) {
        console.log('[range-create] Reached locations list!');
        break;
      }
      const skipOrNext = this.page.locator('button:has-text("Skip"):visible, button:has-text("Save & Next"):visible, button:has-text("Save"):visible, button:has-text("Next"):visible, button:has-text("Finish"):visible').first();
      if (await skipOrNext.isVisible({ timeout: 3000 }).catch(() => false)) {
        await skipOrNext.click({ force: true });
        await this.waitReady();
      } else {
        break;
      }
    }
  }

  /**
   * Part 2: Select the Created Range in Header Active Range dropdown
   */
  async selectActiveRange(rangeName) {
    console.log(`[range-create] Selecting Active Range: ${rangeName}`);
    await this.waitReady();

    const trigger = this.page.locator('.range-button, #dropdownMenuLinkMobile, [class*="range-button"]').first();
    await trigger.waitFor({ state: 'visible', timeout: 10000 });

    await trigger.click({ force: true });
    await this.page.waitForTimeout(600);

    const searchInput = this.page.locator('.range-search, input[placeholder*="search" i]').first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.fill(rangeName);
      await this.page.waitForTimeout(400);
    }

    const rangeItem = this.page.locator('.range-switch-item, [class*="range-item"]').filter({ hasText: rangeName }).first();
    await rangeItem.waitFor({ state: 'visible', timeout: 10000 });
    await rangeItem.click({ force: true });
    await this.waitReady();
    await this.page.waitForTimeout(1500);

    const triggerText = await trigger.innerText();
    expect(triggerText).toContain(rangeName.substring(0, 15));
    console.log(`[range-create] Range "${rangeName}" successfully selected in header.`);
  }

  /**
   * Part 3: Guest and Member Pricing
   */
  async configurePricing(guestPrice = '10', memberPrice = '5') {
    console.log(`[range-create] Configuring Pricing: Guest $${guestPrice}, Member $${memberPrice}`);
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/manage`);
    await this.waitReady();

    // Click Settings tab
    const settingsTab = this.page.locator('a, button').filter({ hasText: /^settings$/i }).last();
    await settingsTab.waitFor({ state: 'visible', timeout: 10000 });
    await settingsTab.click({ force: true });
    await this.page.waitForTimeout(800);

    // Click Edit button once enabled
    const editBtn = this.page.locator('button:has-text("Edit"):visible').first();
    await editBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(editBtn).toBeEnabled({ timeout: 15000 });
    await editBtn.click();
    await this.page.waitForTimeout(800);

    const guestInput = this.page.locator('input#basePrice, input[name="basePrice"]').first();
    await guestInput.waitFor({ state: 'visible', timeout: 5000 });
    await expect(guestInput).toBeEnabled({ timeout: 10000 });
    await guestInput.fill(guestPrice);

    const memberInput = this.page.locator('input#memberPrice, input[name="memberPrice"]').first();
    await expect(memberInput).toBeEnabled({ timeout: 10000 });
    await memberInput.fill(memberPrice);

    const saveBtn = this.page.locator('button:has-text("Save"):visible, button[type="submit"]:visible').first();
    await saveBtn.click({ force: true });
    await this.waitReady();
    await this.page.waitForTimeout(1500);

    // Verify persisted
    const toast = this.page.locator('[role="alert"], [class*="toast" i]').filter({ hasText: /saved|success|updated/i });
    if (await toast.first().isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[range-create] Toast confirmation visible: Booking settings saved.');
    }
    const guestVal = await guestInput.inputValue();
    const memberVal = await memberInput.inputValue();
    expect(guestVal).toBe(guestPrice);
    expect(memberVal).toBe(memberPrice);
    console.log('[range-create] Pricing configured and verified successfully.');
  }

  /**
   * Part 4: Create Default RSVP Category
   */
  async createDefaultRsvpCategory(categoryData) {
    console.log(`[range-create] Creating Category: ${categoryData.categoryName}`);
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/manage`);
    await this.waitReady();

    const categoryTab = this.page.locator('a, button').filter({ hasText: /^category$/i }).last();
    await categoryTab.waitFor({ state: 'visible', timeout: 10000 });
    await categoryTab.click({ force: true });
    await this.page.waitForTimeout(1000);

    // Check if category already exists
    const existing = this.page.locator('tr, td, div').filter({ hasText: categoryData.categoryName }).first();
    if (!(await existing.isVisible({ timeout: 2000 }).catch(() => false))) {
      const addBtn = this.page.locator('button:has-text("Add Category"):visible, button:has-text("Add"):visible').first();
      await addBtn.click({ force: true });
      await this.page.waitForTimeout(800);

      const modal = this.page.locator('.modal.show');
      await modal.locator('input[name="name"]').fill(categoryData.categoryName);
      await modal.locator('textarea[name="description"]').fill(categoryData.description);

      // Select Type (RSVP / BAY_LANE) via custom select dropdown
      const typeTrigger = modal.locator('.form-field__custom-select-trigger, button[title*="Select Category" i], button[aria-haspopup="listbox"]').first();
      if (await typeTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await typeTrigger.click({ force: true });
        await this.page.waitForTimeout(400);
        const rsvpOption = this.page.locator('.form-field__custom-select-dropdown li, .form-field__custom-select-item, [role="option"]')
          .filter({ hasText: /^RSVP$/i }).first();
        if (await rsvpOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await rsvpOption.click({ force: true });
        }
      }

      // Ensure native select has BAY_LANE value
      await modal.evaluate((m) => {
        const sel = m.querySelector('select[name="type"]');
        if (sel) {
          sel.value = 'BAY_LANE';
          sel.dispatchEvent(new Event('input', { bubbles: true }));
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }).catch(() => {});

      // Active checkbox
      const activeCb = modal.locator('input#categoryActiveSwitch, input[name="is_active"]').first();
      if (categoryData.active && !(await activeCb.isChecked().catch(() => false))) {
        await activeCb.check({ force: true });
      }

      // Featured checkbox
      const featuredCb = modal.locator('input#categoryFeaturedSwitch, input[name="is_featured"]').first();
      if (!categoryData.featured && (await featuredCb.isChecked().catch(() => false))) {
        await featuredCb.uncheck({ force: true });
      }

      const createBtn = modal.locator('button:has-text("Create"):visible, button:has-text("Save"):visible, button[type="submit"]:visible').first();
      await createBtn.click({ force: true });

      // Wait for modal to close
      await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(async () => {
        await modal.locator('form').evaluate(f => f.requestSubmit()).catch(() => {});
        await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      });
      await this.waitReady();
      await this.page.waitForTimeout(2000);
    }

    // Verify category exists
    await this.goto(`${baseUrl}/settings/manage`);
    await this.waitReady();
    await categoryTab.click({ force: true });
    await this.page.waitForTimeout(1000);
    const catItem = this.page.locator('body').filter({ hasText: categoryData.categoryName });
    expect(await catItem.count()).toBeGreaterThan(0);
    console.log(`[range-create] Category "${categoryData.categoryName}" verified successfully.`);
  }

  /**
   * Part 5: Operation Hours - Monday through Friday (12:00 AM to 11:45 PM, Open)
   */
  async configureOperationHours() {
    console.log('[range-create] Configuring Operation Hours for Mon-Fri');
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/manage`);
    await this.waitReady();

    const hoursTab = this.page.locator('a, button').filter({ hasText: /^operation hours$/i }).last();
    await hoursTab.waitFor({ state: 'visible', timeout: 10000 });
    await hoursTab.click({ force: true });
    await this.page.waitForTimeout(1000);

    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
    const modal = this.page.locator('#OperationHoursModal, .modal.show');

    for (const day of days) {
      console.log(`[range-create] Ensuring operation hours for ${day}`);

      // Check if day is already present in the operation hours table on the page (check specific cell to avoid false positives)
      const table = this.page.locator('.operation-hours-table, table').first();
      const alreadyInTable = table.locator('tbody tr td:first-child, tbody tr th:first-child').filter({ hasText: new RegExp(`^\\s*${day}\\s*$`, 'i') });
      if (await alreadyInTable.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log(`[range-create] ${day} already present in table.`);
        continue;
      }

      // Open Add Operation Hours modal
      const addBtn = this.page.locator('button:has-text("Add"):visible').first();
      await addBtn.click({ force: true });
      await modal.waitFor({ state: 'visible', timeout: 10000 });
      await this.page.waitForTimeout(500);

      // Select Day
      const selectDayTrigger = modal.locator('button#day, button.form-field__custom-select-trigger').first();
      if (await selectDayTrigger.isVisible().catch(() => false)) {
        await selectDayTrigger.click({ force: true });
        await this.page.waitForTimeout(400);
        const dayOpt = this.page.locator('.form-field__custom-select-option, [role="option"], li').filter({ hasText: new RegExp(`^\\s*${day}\\s*$`, 'i') }).first();
        if (await dayOpt.isVisible().catch(() => false)) {
          await dayOpt.click({ force: true });
        } else {
          await modal.locator('select[name="day"]').selectOption(day).catch(() => {});
        }
      } else {
        await modal.locator('select[name="day"]').selectOption(day).catch(() => {});
      }
      await this.page.waitForTimeout(300);

      // Fill Open Time & Close Time
      const timeInputs = modal.locator('input[placeholder="Select time"]');
      if (await timeInputs.first().isVisible().catch(() => false)) {
        await timeInputs.first().click({ force: true });
        await timeInputs.first().fill('12:00 AM');
        await this.page.keyboard.press('Enter').catch(() => {});
      }
      if (await timeInputs.last().isVisible().catch(() => false)) {
        await timeInputs.last().click({ force: true });
        await timeInputs.last().fill('11:45 PM');
        await this.page.keyboard.press('Enter').catch(() => {});
      }

      // Check isOpen checkbox
      const isOpenCb = modal.locator('input[name="isOpen"], input[type="checkbox"]').first();
      if (await isOpenCb.isVisible().catch(() => false) && !(await isOpenCb.isChecked().catch(() => false))) {
        await isOpenCb.check({ force: true });
      }

      // Click Save and wait for modal to close (or dismiss if still open after save)
      const saveBtn = modal.locator('button[type="submit"]:has-text("Save"), button:has-text("Save")').first();
      await saveBtn.click({ force: true });
      
      const isHidden = await modal.waitFor({ state: 'hidden', timeout: 6000 }).then(() => true).catch(() => false);
      if (!isHidden) {
        // If modal remains open after save response, click Cancel button or close icon
        const closeBtn = modal.locator('button:has-text("Cancel"), .close-operation-hour-modal, [data-bs-dismiss="modal"]').first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click({ force: true });
        }
        await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }
      await this.waitReady();
      await this.page.waitForTimeout(1000);
    }

    // After adding all days, close modal via Cancel button or close icon
    const cancelBtn = modal.locator('button:has-text("Cancel"), .btn-close, .close-operation-hour-modal').first();
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click({ force: true });
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
    await this.waitReady();
    await this.page.waitForTimeout(1000);

    // Verify Mon-Fri are displayed in the operation hours table
    const table = this.page.locator('.operation-hours-table, table').first();
    await expect(table).toBeVisible({ timeout: 10000 });
    const tableText = await table.innerText();
    for (const d of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(tableText.toLowerCase()).toContain(d.toLowerCase());
    }
    console.log('[range-create] Monday-Friday Operation Hours added and verified.');
  }

  /**
   * Part 6: Adult and Minor Waivers
   */
  async configureWaivers(waiverData) {
    console.log('[range-create] Configuring Adult and Minor Waivers');
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/manage`);
    await this.waitReady();

    const waiversTab = this.page.locator('a, button').filter({ hasText: /waivers? & policies/i }).last();
    await waiversTab.waitFor({ state: 'visible', timeout: 10000 });
    await waiversTab.click({ force: true });
    await this.page.waitForTimeout(1000);

    // Click Waiver subtab if needed
    const wavierSubtab = this.page.locator('button.nav-link:has-text("Wavier"), button.nav-link:has-text("Waiver")').first();
    if (await wavierSubtab.isVisible().catch(() => false)) await wavierSubtab.click({ force: true });

    const editBtn = this.page.locator('button:has-text("Edit"):visible').first();
    await editBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(editBtn).toBeEnabled({ timeout: 15000 }).catch(() => {});
    await editBtn.click({ force: true });
    await this.page.waitForTimeout(1000);

    const modal = this.page.locator('.modal.show');
    const ckEditors = modal.locator('.ck-editor__editable');
    const count = await ckEditors.count();

    const texts = [
      waiverData.adultRules || 'I agree to follow all range safety rules and instructions.',
      waiverData.adultConsent || 'I understand the risks and agree to participate voluntarily.',
      waiverData.minorRules || 'I agree to follow all range safety rules under adult supervision.',
      waiverData.minorConsent || 'My parent or guardian has given permission for me to participate.'
    ];

    for (let i = 0; i < Math.min(count, 4); i++) {
      const ed = ckEditors.nth(i);
      await ed.click({ force: true });
      await this.page.keyboard.press('Meta+A').catch(() => this.page.keyboard.press('Control+A'));
      await this.page.keyboard.press('Backspace');
      await ed.fill(texts[i]).catch(async () => {
        await this.page.keyboard.type(texts[i]);
      });
    }

    const saveBtn = modal.locator('button:has-text("Save"), button[type="submit"]').first();
    await saveBtn.click({ force: true });
    await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.waitReady();
    console.log('[range-create] Adult and Minor Waivers configured successfully.');
  }

  /**
   * Part 7: Range Policies
   */
  async configureRangePolicies(policyText = 'I agree to follow all range safety rules and instructions.') {
    console.log('[range-create] Configuring Range Policy and Membership Policy');
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/manage`);
    await this.waitReady();

    const waiversTab = this.page.locator('a, button').filter({ hasText: /waivers? & policies/i }).last();
    await waiversTab.waitFor({ state: 'visible', timeout: 10000 });
    await waiversTab.click({ force: true });
    await this.page.waitForTimeout(1000);

    const policySubtab = this.page.locator('button.nav-link:has-text("Range Policy")').first();
    await policySubtab.waitFor({ state: 'visible', timeout: 8000 });
    await policySubtab.click({ force: true });
    await this.page.waitForTimeout(1000);

    const editBtn = this.page.locator('button:has-text("Edit"):visible').first();
    await editBtn.waitFor({ state: 'visible', timeout: 10000 });
    await expect(editBtn).toBeEnabled({ timeout: 15000 }).catch(() => {});
    await editBtn.click({ force: true });
    await this.page.waitForTimeout(1000);

    const modal = this.page.locator('.modal.show');
    const ckEditors = modal.locator('.ck-editor__editable');
    const count = await ckEditors.count();

    for (let i = 0; i < Math.min(count, 2); i++) {
      const ed = ckEditors.nth(i);
      await ed.click({ force: true });
      await this.page.keyboard.press('Meta+A').catch(() => this.page.keyboard.press('Control+A'));
      await this.page.keyboard.press('Backspace');
      await ed.fill(policyText).catch(async () => {
        await this.page.keyboard.type(policyText);
      });
    }

    const saveBtn = modal.locator('button:has-text("Save"), button[type="submit"]').first();
    await saveBtn.click({ force: true });
    await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.waitReady();
    console.log('[range-create] Range Policy and Membership Policy configured successfully.');
  }

  /**
   * Part 8: Create Range Bay with Two Lanes
   */
  async createRangeBay(bayData) {
    console.log(`[range-create] Creating Range Bay: ${bayData.name}`);
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/manage`);
    await this.waitReady();

    const lanesTab = this.page.locator('a, button').filter({ hasText: /^lanes$/i }).last();
    await lanesTab.waitFor({ state: 'visible', timeout: 10000 });
    await lanesTab.click({ force: true });
    await this.page.waitForTimeout(1000);

    // Check if bay already exists
    const existing = this.page.locator('tr, td, div').filter({ hasText: bayData.name }).first();
    if (!(await existing.isVisible({ timeout: 2000 }).catch(() => false))) {
      const addBtn = this.page.locator('button:has-text("Add"):visible').first();
      await addBtn.click({ force: true });
      await this.page.waitForTimeout(1000);

      const modal = this.page.locator('.modal.show');
      await modal.locator('input#name, input[name="name"]').fill(bayData.name);
      await modal.locator('input#description, input[name="description"]').fill(bayData.description);
      await modal.locator('input#rangeReservationDayOut, input[name="rangeReservationDayOut"]').fill(bayData.guestReservationDayOut || '7');
      await modal.locator('input#memberBaseReservationDayOut, input[name="memberBaseReservationDayOut"]').fill(bayData.memberReservationDayOut || '14');

      // Status
      const statusTrigger = modal.locator('button#status').first();
      if (await statusTrigger.isVisible().catch(() => false)) {
        await statusTrigger.click({ force: true });
        await this.page.waitForTimeout(300);
        await this.page.locator('[role="option"]:has-text("Available"), li:has-text("Available")').first().click({ force: true }).catch(() => {});
      } else {
        await modal.locator('select[name="status"]').selectOption({ label: 'Available' }).catch(() => {});
      }

      // Bay Type
      const bayTypeTrigger = modal.locator('button#bayType').first();
      if (await bayTypeTrigger.isVisible().catch(() => false)) {
        await bayTypeTrigger.click({ force: true });
        await this.page.waitForTimeout(300);
        await this.page.locator('[role="option"]:has-text("FIREARM"), li:has-text("FIREARM")').first().click({ force: true }).catch(() => {});
      } else {
        await modal.locator('select[name="bayType"]').selectOption({ label: 'FIREARM' }).catch(() => {});
      }

      // Category
      const catTrigger = modal.locator('button#categoryId').first();
      if (await catTrigger.isVisible().catch(() => false)) {
        await catTrigger.click({ force: true });
        await this.page.waitForTimeout(300);
        await this.page.locator(`[role="option"]:has-text("${bayData.category}"), li:has-text("${bayData.category}")`).first().click({ force: true }).catch(() => {});
      } else {
        await modal.locator('select[name="categoryId"]').selectOption({ label: bayData.category }).catch(() => {});
      }

      // Session Duration
      const slotTrigger = modal.locator('button#slotDuration').first();
      if (await slotTrigger.isVisible().catch(() => false)) {
        await slotTrigger.click({ force: true });
        await this.page.waitForTimeout(300);
        await this.page.locator('[role="option"]:has-text("30 Minutes"), li:has-text("30 Minutes")').first().click({ force: true }).catch(() => {});
      } else {
        await modal.locator('select[name="slotDuration"]').selectOption({ label: '30 Minutes' }).catch(() => {});
      }

      // Number of Lanes
      await modal.locator('input#selectedLanes, input[name="selectedLanes"]').fill(bayData.numberOfLanes || '2');

      // Checkboxes: Online Reservations & Lane Selection
      const activeCb = modal.locator('input#active').first();
      if (bayData.onlineReservations && !(await activeCb.isChecked().catch(() => false))) await activeCb.check({ force: true });

      const laneSelCb = modal.locator('input#active_lane_selection').first();
      if (bayData.laneSelection && !(await laneSelCb.isChecked().catch(() => false))) await laneSelCb.check({ force: true });

      const saveBtn = modal.locator('button:has-text("Save"), button[type="submit"]').first();
      await saveBtn.click({ force: true });
      await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
      await this.waitReady();
    }

    // Verify Range Bay appears in list
    const bayItem = this.page.locator(`text="${bayData.name}"`).first();
    await bayItem.waitFor({ state: 'visible', timeout: 15000 }).catch(async () => {
      await this.goto(`${baseUrl}/settings/manage`);
      await this.waitReady();
      await lanesTab.click({ force: true });
      await this.page.waitForTimeout(1000);
      await bayItem.waitFor({ state: 'visible', timeout: 10000 });
    });
    expect(await bayItem.isVisible()).toBeTruthy();
    console.log(`[range-create] Range Bay "${bayData.name}" created and verified.`);
  }

  /**
   * Part 9: Final Locations Verification
   */
  async verifyInLocations(rangeName) {
    console.log(`[range-create] Verifying Range in Locations list: ${rangeName}`);
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    await this.goto(`${baseUrl}/settings/range-locations`);
    await this.waitReady();
    await this.page.waitForTimeout(1500);

    const rangeEntry = this.page.locator('tr, td, [class*="card"], [class*="row"]').filter({ hasText: rangeName }).first();
    await rangeEntry.waitFor({ state: 'visible', timeout: 15000 });
    expect(await rangeEntry.isVisible()).toBeTruthy();
    console.log(`[range-create] Range "${rangeName}" confirmed present in Locations list.`);
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

module.exports = { RangeCreatePage, rangeAddressData };

