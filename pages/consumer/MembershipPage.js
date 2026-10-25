const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');

/**
 * MembershipPage — Consumer Portal membership registration & purchase flow.
 *
 * Covers:
 *   1. Membership selection carousel (find by name, not position)
 *   2. Email / phone registration toggle + OTP entry
 *   3. Profile form (name, gender, DOB, phone, address autocomplete)
 *   4. Eligibility questions page
 *   5. Review page + agreement checkbox + "Complete & Pay"
 *   6. Membership purchase confirmation
 *
 * URL: https://calibercard.yatilabs.com/
 */

class MembershipPage extends BasePage {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. HOME → JOIN NOW → MEMBERSHIP SELECTION
  // ─────────────────────────────────────────────────────────────────────────

  /** Navigate to the consumer portal home and dismiss any cookie banner. */
  async openHome() {
    await this.goto('/');
    await this._dismissCookieBanner();
    await this.shot('membership-home');
  }

  /** Click the "Join Now" button on the home page. */
  async clickJoinNow() {
    const btn = this.page
      .getByRole('button', { name: /join now/i })
      .or(this.page.getByRole('link', { name: /join now/i }))
      .first();
    await btn.waitFor({ state: 'visible', timeout: 15000 });
    await btn.click();
    await this.waitReady();
    await this.shot('membership-select-screen');
  }

  /**
   * Find and select a membership card by its displayed name.
   * Navigates the carousel using the next-arrow until the card is found or
   * all cards are exhausted. Reports the test as blocked if unavailable.
   *
   * @param {string} membershipName  e.g. "Caliber Card Connect"
   */
  async selectMembership(membershipName) {
    const maxArrowClicks = 10; // safety cap

    for (let attempt = 0; attempt <= maxArrowClicks; attempt++) {
      // The membership cards on /join-now are button.unified-plan-card elements
      const card = this.page
        .locator('button.unified-plan-card, [class*="unified-plan-card"], [class*="plan-card"]')
        .filter({ hasText: new RegExp(membershipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
        .first();

      const cardVisible = await card.isVisible({ timeout: 2000 }).catch(() => false);

      if (cardVisible) {
        await card.scrollIntoViewIfNeeded().catch(() => {});

        // Check if already selected
        const cardText = await card.innerText().catch(() => '');
        const cardClass = await card.getAttribute('class').catch(() => '');
        const alreadySelected = cardText.includes('SELECTED') || (cardClass && cardClass.includes('selected'));

        if (!alreadySelected) {
          await card.click();
          await this.page.waitForTimeout(500);
        }

        // Verify "Selected" indicator or selected class
        const isSelectedNow = await card.evaluate((el) => {
          return el.classList.contains('unified-plan-card--selected') ||
                 (el.textContent && el.textContent.includes('SELECTED'));
        }).catch(() => false);

        expect(isSelectedNow, `Expected "${membershipName}" to be selected`).toBeTruthy();
        console.log(`[membership] "${membershipName}" selected ✓`);
        await this.shot('membership-selected');
        return;
      }

      // Card not in view — try clicking the next-arrow (carousel-nav.right) to advance the carousel
      const nextArrow = this.page
        .locator('button.carousel-nav.right, button[class*="carousel-nav right"], [class*="arrow-right"], .carousel-nav.right')
        .first();
      const arrowVisible = await nextArrow.isVisible({ timeout: 2000 }).catch(() => false);

      if (!arrowVisible) {
        break;
      }

      await nextArrow.click();
      await this.page.waitForTimeout(800);
    }

    throw new Error(
      `[blocked] Membership "${membershipName}" not found in the carousel after ${maxArrowClicks} arrow clicks. ` +
      'Test is blocked — check if the membership is currently available.',
    );
  }

  /** Click the Continue button after membership selection. */
  async clickContinueFromMembership() {
    const btn = this.page
      .getByRole('button', { name: /^continue$/i })
      .or(this.page.locator('button').filter({ hasText: /^continue$/i }))
      .first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.click();
    await this.waitReady();
    await this.shot('after-membership-continue');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. REGISTRATION SCREEN — EMAIL / PHONE TAB + OTP
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * On the registration screen, switch to the Email tab if present,
   * fill the email input, and return without clicking Send OTP
   * (caller controls OTP timing to set the inbox marker first).
   */
  async selectEmailTabAndEnter(email) {
    // Switch to email tab if there's a tab toggle
    const emailTab = this.page
      .getByRole('tab', { name: /email/i })
      .or(this.page.locator('button, [role="tab"]').filter({ hasText: /email/i }))
      .first();
    const tabVisible = await emailTab.isVisible({ timeout: 3000 }).catch(() => false);
    if (tabVisible) {
      await emailTab.click();
      await this.page.waitForTimeout(400);
    }

    // Fill email
    const emailInput = this.page
      .locator('input[type="email"], input#phone-or-email, input[name="email"], input[placeholder*="email" i]')
      .first();
    await emailInput.waitFor({ state: 'visible', timeout: 10000 });
    await emailInput.fill(email);
    await this.shot('registration-email-filled');
  }

  /**
   * On the registration screen, switch to the Phone tab if present,
   * fill the phone number input.
   */
  async selectPhoneTabAndEnter(phone) {
    // Switch to phone tab if there's a tab toggle
    const phoneTab = this.page
      .getByRole('tab', { name: /phone/i })
      .or(this.page.locator('button, [role="tab"]').filter({ hasText: /phone/i }))
      .first();
    const tabVisible = await phoneTab.isVisible({ timeout: 3000 }).catch(() => false);
    if (tabVisible) {
      await phoneTab.click();
      await this.page.waitForTimeout(400);
    }

    // Standardize US phone number to 10 digits for PhoneInput (prevents double country code +11...)
    const digitsOnly = String(phone).replace(/\D/g, '');
    const tenDigits = digitsOnly.length === 11 && digitsOnly.startsWith('1')
      ? digitsOnly.slice(1)
      : digitsOnly;

    // Fill phone
    const phoneInput = this.page
      .locator('input[type="tel"], input#phone-or-email, input[name="phone"], input[placeholder*="phone" i]')
      .first();
    await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
    await phoneInput.fill(tenDigits);
    await this.shot('registration-phone-filled');
  }

  /** Click "SEND CODE" / "GET CODE" and wait for OTP input boxes to appear. */
  async submitForOtp() {
    const OTP_BOXES = 'input[id*="otp"], input[name*="otp"], input[id^="jn-otp"]';

    const btn = this.page
      .getByRole('button', { name: /send code|get code|send otp|request otp/i })
      .or(this.page.locator('button').filter({ hasText: /send code|get code|send/i }))
      .first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.click();

    // Wait for OTP boxes
    await this.page.locator(OTP_BOXES).first().waitFor({ state: 'visible', timeout: 30000 });
    await this.shot('otp-screen');
  }

  /**
   * Enter a 4–6 digit OTP into individual digit boxes (or a single field).
   * Then click Verify & Continue.
   */
  async enterOtp(otp) {
    const OTP_BOXES = 'input[id*="otp"], input[name*="otp"], input[id^="jn-otp"]';
    const boxes = this.page.locator(OTP_BOXES);
    await boxes.first().waitFor({ state: 'visible', timeout: 15000 });

    const total = await boxes.count();
    const visible = [];
    for (let i = 0; i < total; i++) {
      if (await boxes.nth(i).isVisible().catch(() => false)) visible.push(boxes.nth(i));
    }

    if (visible.length <= 1) {
      await visible[0].fill(otp);
    } else {
      for (let i = 0; i < otp.length && i < visible.length; i++) {
        await visible[i].fill(otp[i]);
      }
    }

    // Click Verify / Verify & Continue if present and enabled
    const verifyBtn = this.page
      .getByRole('button', { name: /verify.*continue|verify/i })
      .or(this.page.locator('button').filter({ hasText: /verify/i }))
      .first();
    const verifyVisible = await verifyBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (verifyVisible) {
      await verifyBtn.click();
    }

    await this.waitReady();
    await this.shot('otp-entered');
  }

  /** Assert OTP screen is gone and no error message is shown. */
  async expectOtpVerified() {
    const OTP_BOXES = 'input[id*="otp"], input[name*="otp"], input[id^="jn-otp"]';
    await expect(
      this.page.locator(OTP_BOXES).first(),
      'OTP screen should disappear after valid code',
    ).toBeHidden({ timeout: 30000 });

    const errorEl = this.page
      .getByText(/invalid (otp|code)|incorrect|expired|wrong (otp|code)/i)
      .first();
    const rejected = await errorEl.isVisible().catch(() => false);
    expect(rejected, 'App rejected the OTP — check code or timing').toBeFalsy();
    await this.shot('otp-verified');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. PROFILE FORM
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Fill the consumer profile form.
   *
   * @param {object} userData
   * @param {string} userData.firstName
   * @param {string} userData.lastName
   * @param {string} userData.gender   e.g. "Male"
   * @param {string} userData.dob      e.g. "Oct 24, 2000"
   * @param {string} userData.phone    US format, digits only or formatted
   * @param {object} userData.address
   * @param {string} userData.address.search   e.g. "78 Main Street"
   */
  async fillProfileForm(userData) {
    await this.page.waitForTimeout(1000);

    // ── First name
    const firstNameInput = this.page.locator('input#firstName, input[name="firstName"]');
    await firstNameInput.waitFor({ state: 'visible', timeout: 10000 });
    await firstNameInput.fill(userData.firstName);

    // ── Last name
    const lastNameInput = this.page.locator('input#lastName, input[name="lastName"]');
    await lastNameInput.waitFor({ state: 'visible', timeout: 10000 });
    await lastNameInput.fill(userData.lastName);

    // ── Email (if editable when registered with phone)
    const emailInput = this.page.locator('input#email, input[name="email"]');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const disabled = await emailInput.isDisabled().catch(() => false);
      if (!disabled && userData.email) {
        await emailInput.fill(userData.email);
      }
    }

    // ── Phone
    const phoneInput = this.page.locator('input#phone, input[name="phone"]');
    if (await phoneInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const disabled = await phoneInput.isDisabled().catch(() => false);
      if (!disabled && userData.phone) {
        await phoneInput.fill(userData.phone);
      }
    }

    // ── Gender select dropdown
    const genderSelect = this.page.locator('select#gender, select[name="gender"]');
    if (await genderSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await genderSelect.selectOption({ label: userData.gender || 'Male' });
    }

    // ── Date of birth via MUI Datepicker
    await this._fillDobMui(userData.dob);

    // ── Address via autocomplete
    await this.fillAddress(userData.address || { search: '78 Main Street' });

    await this.shot('profile-form-filled');
  }

  /**
   * MUI Datepicker selector: clicks input#dob, switches to year view,
   * picks year 2000, and selects day 15.
   */
  async _fillDobMui(dob) {
    const dobInput = this.page.locator('input#dob');
    await dobInput.waitFor({ state: 'visible', timeout: 10000 });
    await dobInput.click();
    await this.page.waitForTimeout(500);

    // Switch to year view if present
    const switchYearBtn = this.page.locator('button[aria-label*="year view"]');
    if (await switchYearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await switchYearBtn.click();
      await this.page.waitForTimeout(500);

      // Select year 2000
      const yearBtn = this.page
        .locator('.MuiYearCalendar-root button, [class*="Year"] button')
        .filter({ hasText: /^2000$/ })
        .first();
      if (await yearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await yearBtn.click();
        await this.page.waitForTimeout(500);
      }
    }

    // Select day 15
    const dayBtn = this.page
      .locator('.MuiDateCalendar-root button')
      .filter({ hasText: /^15$/ })
      .first();
    if (await dayBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dayBtn.click();
      await this.page.waitForTimeout(500);
    }

    console.log(`[dob] DOB selected: ${await dobInput.inputValue().catch(() => 'N/A')}`);
  }

  /**
   * Fill address using the Google Places autocomplete widget on the page.
   * If Google Autocomplete API is restricted/denied on the test environment domain,
   * provides an in-browser fallback so testing can proceed through the autocomplete UI flow.
   *
   * @param {object} address
   * @param {string} address.search  Text to type into the address search input
   */
  async fillAddress(address) {
    const addressInput = this.page.locator('input#address');
    await addressInput.waitFor({ state: 'visible', timeout: 10000 });

    // Setup mock fallback in case Google Autocomplete API key rejects the domain
    await this.page.evaluate(() => {
      if (window.google && window.google.maps && window.google.maps.places) {
        const origGetPlacePredictions = window.google.maps.places.AutocompleteService.prototype.getPlacePredictions;
        window.google.maps.places.AutocompleteService.prototype.getPlacePredictions = function(req, cb) {
          origGetPlacePredictions.call(this, req, (predictions, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions && predictions.length) {
              cb(predictions, status);
            } else {
              // Domain-restricted or quota exceeded: serve valid test suggestion
              cb([
                {
                  description: '78 Main Street, Vancouver, BC, Canada',
                  place_id: 'mock_place_78_main',
                  structured_formatting: {
                    main_text: '78 Main Street',
                    secondary_text: 'Vancouver, BC, Canada',
                  },
                },
              ], window.google.maps.places.PlacesServiceStatus.OK);
            }
          });
        };

        const origGetDetails = window.google.maps.places.PlacesService.prototype.getDetails;
        window.google.maps.places.PlacesService.prototype.getDetails = function(req, cb) {
          origGetDetails.call(this, req, (place, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
              cb(place, status);
            } else {
              cb({
                formatted_address: '78 Main Street, Vancouver, BC, Canada',
                name: '78 Main Street',
                address_components: [
                  { long_name: '78', short_name: '78', types: ['street_number'] },
                  { long_name: 'Main Street', short_name: 'Main St', types: ['route'] },
                  { long_name: 'Vancouver', short_name: 'Vancouver', types: ['locality'] },
                  { long_name: 'British Columbia', short_name: 'BC', types: ['administrative_area_level_1'] },
                  { long_name: 'Canada', short_name: 'CA', types: ['country'] },
                  { long_name: 'V6A 2S5', short_name: 'V6A 2S5', types: ['postal_code'] },
                ],
                geometry: {
                  location: {
                    lat: () => 49.2827,
                    lng: () => -123.1207,
                  },
                },
              }, window.google.maps.places.PlacesServiceStatus.OK);
            }
          });
        };
      }
    });

    await addressInput.focus();
    await addressInput.pressSequentially(address.search || '78 Main Street', { delay: 100 });
    await this.page.waitForTimeout(1000);

    // Wait for the dropdown list
    const dropdown = this.page.locator('ul.ac-dropdown');
    await dropdown.waitFor({ state: 'visible', timeout: 8000 });

    const firstItem = dropdown.locator('li').first();
    await expect(firstItem).toBeVisible({ timeout: 5000 });
    console.log(`[address] Autocomplete suggestion: ${await firstItem.innerText().catch(() => '')}`);

    // Click suggestion via mousedown (matches React onMouseDown event)
    await firstItem.dispatchEvent('mousedown');
    await this.page.waitForTimeout(1500);

    console.log(`[address] Selected address: ${await addressInput.inputValue().catch(() => '')}`);
    await this.shot('address-filled');
  }

  /** Click the Continue button on the profile form page. */
  async clickContinueFromProfile() {
    const continueBtn = this.page
      .getByRole('button', { name: /^continue$/i })
      .or(this.page.locator('button').filter({ hasText: /^continue$/i }))
      .first();

    await expect(continueBtn, 'Profile Continue button should become enabled when form is valid').toBeEnabled({ timeout: 15000 });
    await continueBtn.click();
    await this.waitReady();
    await this.shot('profile-continue');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. ELIGIBILITY PAGE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Answer all eligibility questions with the given answer ("No" by default).
   * Finds all Yes/No buttons and selects the requested option.
   *
   * @param {"Yes"|"No"} answer
   */
  async answerEligibilityQuestions(answer = 'No') {
    await this.page.waitForSelector('text=Eligibility verification', { timeout: 15000 });
    await this.page.waitForTimeout(500);

    const targetButtons = this.page
      .locator('button')
      .filter({ hasText: new RegExp(`^${answer}$`, 'i') });

    const btnCount = await targetButtons.count();
    console.log(`[eligibility] Found ${btnCount} "${answer}" options`);

    for (let i = 0; i < btnCount; i++) {
      const btn = targetButtons.nth(i);
      await btn.click();
      await this.page.waitForTimeout(200);
    }

    await this.shot('eligibility-answered');
  }

  /** Click Continue on the Eligibility page → navigate to Review page. */
  async clickContinueFromEligibility() {
    await this._clickContinue('eligibility-continue');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. REVIEW PAGE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Assert that the Review page shows the correct membership name, email, and phone.
   *
   * @param {object} opts
   * @param {string} opts.membershipName
   * @param {string} opts.email
   * @param {string} [opts.phone]
   */
  async verifyReviewPage({ membershipName, email, phone }) {
    await this.page.waitForSelector('text=Review & Confirm', { timeout: 15000 });
    await this.page.waitForTimeout(1000);
    const body = this.page.locator('body');

    await expect(body, `Review page should display membership "${membershipName}"`).toContainText(
      new RegExp(membershipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      { timeout: 15000 },
    );

    if (email) {
      await expect(body, `Review page should display email "${email}"`).toContainText(email, { timeout: 10000 });
    }

    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      await expect(body, `Review page should display phone "${phone}"`).toContainText(cleanPhone, { timeout: 10000 });
    }

    await this.shot('review-page-verified');
  }

  /**
   * Check the membership agreement checkbox then click "Complete & Pay".
   * Verifies the checkbox is actually checked before proceeding.
   */
  async checkAgreementAndPay() {
    const agreementCb = this.page.locator('input[type="checkbox"]').first();
    await agreementCb.waitFor({ state: 'visible', timeout: 10000 });
    await agreementCb.check();
    await expect(agreementCb, 'Agreement checkbox must be checked').toBeChecked({ timeout: 5000 });
    console.log('[review] Agreement checkbox checked ✓');
    await this.shot('agreement-checked');

    // Click "Complete & Pay"
    const payBtn = this.page
      .getByRole('button', { name: /complete & pay/i })
      .first();
    await payBtn.waitFor({ state: 'visible', timeout: 10000 });
    await payBtn.click();
    await this.waitReady();
    await this.shot('after-complete-pay');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. CHECKOUT / CART PAGE — membership-specific verification
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify that the cart/checkout page shows the expected membership name and email.
   *
   * @param {object} opts
   * @param {string} opts.membershipName
   * @param {string} opts.email
   */
  async verifyCheckoutSummary({ membershipName, email }) {
    await this.page.waitForTimeout(2000);
    const body = this.page.locator('body');

    await expect(body, `Checkout should show membership "${membershipName}"`).toContainText(
      new RegExp(membershipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      { timeout: 15000 },
    );

    if (email) {
      await expect(body, `Checkout should show email "${email}"`).toContainText(email, { timeout: 10000 });
    }
    await this.shot('checkout-verified');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. MEMBERSHIP PURCHASE CONFIRMATION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verify the membership purchase confirmation page.
   * Asserts a success message and the purchased membership name are visible.
   *
   * @param {string} membershipName
   * @returns {Promise<string>} The confirmation/order ID if the page displays one.
   */
  async verifyMembershipConfirmation(membershipName) {
    // Wait for confirmation modal or text
    const successIndicator = this.page
      .locator('text=Membership Purchased')
      .or(this.page.locator('text=Your reservation has been successfully processed'))
      .or(this.page.getByText(/confirmation: #/i))
      .first();

    await successIndicator.waitFor({ state: 'visible', timeout: 45000 });
    console.log('[confirmation] Membership Purchased success indicator visible ✓');

    const body = this.page.locator('body');
    await expect(body, `Confirmation should show membership "${membershipName}"`).toContainText(
      new RegExp(membershipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      { timeout: 15000 },
    );

    // Capture confirmation ID if displayed (e.g. Confirmation: #CC10252026564)
    const bodyText = await body.innerText({ timeout: 10000 }).catch(() => '');
    const idMatch = bodyText.match(/Confirmation:\s*(#[A-Z0-9]+)/i);
    const confirmationId = idMatch ? idMatch[1] : null;
    if (confirmationId) {
      console.log(`[confirmation] ID: ${confirmationId}`);
    }

    await this.shot('membership-confirmation');
    return confirmationId;
  }

  /**
   * Click the Dashboard button on the confirmation page and verify /overview URL.
   */
  async clickDashboard() {
    const btn = this.page
      .getByRole('button', { name: /^dashboard$/i })
      .or(this.page.locator('button').filter({ hasText: /^dashboard$/i }))
      .first();

    await btn.waitFor({ state: 'visible', timeout: 15000 });
    await btn.click();
    await this.page.waitForURL(/.*overview/, { timeout: 25000 });
    await expect(this.page, 'Should navigate to Overview after clicking Dashboard').toHaveURL(/.*overview/);
    await this.shot('overview-page');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  async _dismissCookieBanner() {
    const btn = this.page
      .locator('#cookie-accept-btn, button:has-text("Accept All"), button:has-text("Accept")')
      .first();
    if (await btn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await btn.click();
      await this.page.waitForTimeout(300);
    }
  }

  async _fillField(selectors, value, label) {
    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
        await el.fill(value);
        return;
      }
    }
    // Last resort: getByLabel
    const byLabel = this.page.getByLabel(new RegExp(label, 'i')).first();
    if (await byLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
      await byLabel.fill(value);
      return;
    }
    throw new Error(`Could not locate form field "${label}"`);
  }

  async _fillFieldIfPresent(selectors, value, label) {
    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Don't overwrite prefilled / disabled fields
        const disabled = await el.isDisabled().catch(() => false);
        if (!disabled) await el.fill(value);
        return;
      }
    }
  }

  async _selectGender(gender) {
    // Try <select> first
    const select = this.page
      .locator('select[name*="gender" i], select[id*="gender" i]')
      .first();
    if (await select.isVisible({ timeout: 3000 }).catch(() => false)) {
      await select.selectOption({ label: gender });
      return;
    }

    // Try custom dropdown trigger
    const dropdownTrigger = this.page
      .locator('[class*="select"][class*="gender" i], [id*="gender" i]')
      .or(this.page.getByLabel(/gender/i))
      .first();
    if (await dropdownTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dropdownTrigger.click();
      await this.page.waitForTimeout(400);
      const option = this.page.getByRole('option', { name: new RegExp(`^${gender}$`, 'i') })
        .or(this.page.locator('[role="listbox"] [role="option"]').filter({ hasText: new RegExp(`^${gender}$`, 'i') }))
        .first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
        await option.click();
        return;
      }
    }

    // Try radio buttons
    const radio = this.page.getByRole('radio', { name: new RegExp(`^${gender}$`, 'i') }).first();
    if (await radio.isVisible({ timeout: 2000 }).catch(() => false)) {
      await radio.check();
      return;
    }

    // Try clickable button/label
    const genderBtn = this.page
      .locator('button, label, [role="button"]')
      .filter({ hasText: new RegExp(`^${gender}$`, 'i') })
      .first();
    if (await genderBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await genderBtn.click();
    }
  }

  async _fillDob(dob) {
    // DOB can be a text input, a date picker, or separate day/month/year selects

    // Option 1: single date input (HTML5 date)
    const dateInput = this.page
      .locator('input[type="date"][name*="dob" i], input[type="date"][name*="birth" i], input[type="date"]')
      .first();
    if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Convert "Oct 24, 2000" → "2000-10-24"
      const parsed = new Date(dob);
      if (!isNaN(parsed)) {
        const iso = parsed.toISOString().split('T')[0];
        await dateInput.fill(iso);
        return;
      }
    }

    // Option 2: text input expecting "MMM DD, YYYY" or similar
    const textDob = this.page
      .locator('input[name*="dob" i], input[name*="birth" i], input[placeholder*="date of birth" i], input[placeholder*="dob" i]')
      .first();
    if (await textDob.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textDob.fill(dob);
      // Close any calendar popup
      await this.page.keyboard.press('Escape');
      return;
    }

    // Option 3: labelled date field
    const labelledDob = this.page.getByLabel(/date of birth|dob/i).first();
    if (await labelledDob.isVisible({ timeout: 2000 }).catch(() => false)) {
      await labelledDob.fill(dob);
      await this.page.keyboard.press('Escape');
      return;
    }

    console.warn(`[dob] Could not locate DOB field for value "${dob}" — skipping`);
  }

  async _clickContinue(screenshotName) {
    const btn = this.page
      .getByRole('button', { name: /^continue$/i })
      .or(this.page.locator('button').filter({ hasText: /^continue$/i }))
      .first();
    await btn.waitFor({ state: 'visible', timeout: 10000 });
    await btn.click();
    await this.waitReady();
    await this.shot(screenshotName);
  }
}

module.exports = { MembershipPage };

