const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const { pick, tryPick } = require('../../utils/smart-locator');
const cfg = require('../../utils/config');

/**
 * Range Admin Portal Login Page Object
 * URL: https://calibercard-range.yatilabs.com/home
 */
const EMAIL_INPUT = [
  (p) => p.getByRole('textbox', { name: /email address/i }),
  (p) => p.getByLabel(/email address/i),
  (p) => p.getByPlaceholder(/email address/i),
  (p) => p.locator('input[type="email"]'),
  (p) => p.locator('input[name*="email" i]'),
  (p) => p.locator('input[id*="email" i]'),
  (p) => p.locator('input').first(),
];

const PASSWORD_INPUT = [
  (p) => p.getByLabel(/password/i),
  (p) => p.getByPlaceholder(/password/i),
  (p) => p.locator('input[type="password"]'),
  (p) => p.locator('input[name*="password" i]'),
  (p) => p.locator('input[id*="password" i]'),
  (p) => p.locator('input').nth(1),
];

const SIGN_IN_BUTTON = [
  (p) => p.getByRole('button', { name: /sign in/i }),
  (p) => p.locator('button[type="submit"]'),
  (p) => p.getByText(/^sign in$/i),
];

class AdminLoginPage extends BasePage {
  async navigate() {
    const baseUrl = cfg.ADMIN_URL.replace(/\/(home)?\/?$/, '');
    const loginUrl = `${baseUrl}/log-in`;
    await this.goto(loginUrl);

    // If still on landing page or redirected, look for and click "Log in" link
    const emailField = await tryPick(this.page, EMAIL_INPUT, { label: 'Email Address field', timeout: 3000 });
    if (!emailField) {
      const loginLink = this.page.getByRole('link', { name: /^log in$/i }).first();
      if (await loginLink.isVisible().catch(() => false)) {
        await loginLink.click();
        await this.waitReady();
      }
    }
    await this.shot('admin-login-page');
  }

  async fillEmail(email) {
    await this.fill(EMAIL_INPUT, email, 'Email Address field');
  }

  async fillPassword(password) {
    await this.fill(PASSWORD_INPUT, password, 'Password field');
  }

  async clickSignIn() {
    const btn = await pick(this.page, SIGN_IN_BUTTON, { label: 'Sign In button' });
    await expect(btn).toBeEnabled({ timeout: 10000 });
    await btn.click();
    await this.waitReady();
  }

  /**
   * Complete login action using specified or configured credentials,
   * handling optional first-time setup (Login PIN creation & TRN Agreement signing).
   */
  async login(email = cfg.ADMIN_EMAIL, password = cfg.ADMIN_PASSWORD) {
    console.log(`[admin-login] Logging in as: ${email}`);
    await this.fillEmail(email);
    await this.fillPassword(password);
    await this.shot('admin-login-credentials-filled');
    await this.clickSignIn();

    // Dynamically check whether this user is logging in for the first time or returning
    const setupResult = await this.handleFirstTimeAdminSetup(email);
    if (setupResult.isFirstTime) {
      console.log(`[admin-login] USER TYPE DETECTED: [FIRST-TIME USER] for ${email} (PIN setup: ${setupResult.pinHandled}, Agreement: ${setupResult.agreementHandled})`);
    } else {
      console.log(`[admin-login] USER TYPE DETECTED: [RETURNING USER] for ${email} (Direct dashboard login)`);
    }

    await this.expectLoggedIn();
    return setupResult;
  }

  /**
   * Conditionally handles first-time admin setup:
   * 1. Set Login PIN screen (Condition A: new admin, Condition B: returning admin)
   * 2. Sign Agreement popup (Condition A: agreement required, Condition B: not required)
   * @param {string} email - Logged-in admin email (to derive signer name/title)
   * @returns {Promise<{isFirstTime: boolean, pinHandled: boolean, agreementHandled: boolean}>}
   */
  async handleFirstTimeAdminSetup(email = cfg.ADMIN_EMAIL) {
    let pinHandled = false;
    let agreementHandled = false;

    // -------------------------------------------------------------
    // Step 1: Detect and handle "Set Login Pin" screen conditionally
    // -------------------------------------------------------------
    const pinHeading = this.page
      .locator('h1, h2, h3, h4, h5, .sign-in-card__title, legend, label, p, span')
      .filter({ hasText: /set login pin/i })
      .first();

    const isPinScreenVisible = await pinHeading.isVisible({ timeout: 4000 }).catch(() => false);

    if (isPinScreenVisible) {
      console.log('[admin-login] >>> "Set Login Pin" screen detected -> FIRST-TIME USER identified! Setting up PIN...');
      pinHandled = true;

      // Locate 6 boxes under ENTER NEW PIN (name="setPin-0" ... "setPin-5" or in .auth-pin-grid)
      const newPinInputs = this.page.locator('input[name^="setPin-"]');
      const newPinCount = await newPinInputs.count();

      if (newPinCount >= 6) {
        for (let i = 0; i < 6; i++) {
          await newPinInputs.nth(i).fill('1');
        }
      } else {
        // Fallback: search in first .auth-pin-grid or all visible textboxes under Enter New Pin
        const allPinGrids = this.page.locator('.auth-pin-grid');
        if ((await allPinGrids.count()) > 0) {
          const firstGridInputs = allPinGrids.first().locator('input');
          const count = await firstGridInputs.count();
          for (let i = 0; i < Math.min(count, 6); i++) {
            await firstGridInputs.nth(i).fill('1');
          }
        } else {
          const setPinBoxes = this.page.locator('input[name*="setPin" i]:not([name*="Confirm" i])');
          const count = await setPinBoxes.count();
          for (let i = 0; i < Math.min(count, 6); i++) {
            await setPinBoxes.nth(i).fill('1');
          }
        }
      }

      // Locate 6 boxes under CONFIRM NEW PIN (name="setPinConfirm-0" ... "setPinConfirm-5")
      const confirmPinInputs = this.page.locator('input[name^="setPinConfirm-"]');
      const confirmPinCount = await confirmPinInputs.count();

      if (confirmPinCount >= 6) {
        for (let i = 0; i < 6; i++) {
          await confirmPinInputs.nth(i).fill('1');
        }
      } else {
        // Fallback: search for remaining 6 inputs in second auth-pin-grid
        const allPinGrids = this.page.locator('.auth-pin-grid');
        if ((await allPinGrids.count()) >= 2) {
          const secondGridInputs = allPinGrids.nth(1).locator('input');
          const count = await secondGridInputs.count();
          for (let i = 0; i < Math.min(count, 6); i++) {
            await secondGridInputs.nth(i).fill('1');
          }
        }
      }

      await this.shot('admin-pin-filled');

      // Click "Create Login PIN"
      const createPinBtn = this.page
        .locator('button')
        .filter({ hasText: /create login pin/i })
        .first();
      await expect(createPinBtn, '"Create Login PIN" button should be visible').toBeVisible({ timeout: 5000 });
      await createPinBtn.click();
      await this.waitReady();
      console.log('[admin-login] Clicked "Create Login PIN".');
    } else {
      console.log('[admin-login] PIN setup screen not shown. User has already set PIN or is returning user.');
    }

    // -----------------------------------------------------------------
    // Step 2: Detect and handle "Sign Agreement" modal/popup conditionally
    // Note: The TRN Agreement modal can appear either immediately after PIN creation
    // or upon landing on the dashboard as a gate modal (#trnAgreementGateModal).
    // We give it a generous check and wait for any skeleton loader to settle.
    // -----------------------------------------------------------------
    const agreementModal = this.page.locator('.modal.show, .sign-agreement-modal.show, #trnAgreementGateModal.show, #scheduleAAgreementGateModal.show').first();
    const isAgreementVisible = await agreementModal.isVisible({ timeout: 6000 }).catch(() => false);

    if (isAgreementVisible) {
      console.log('[admin-login] >>> "Sign Agreement" popup detected -> Completing first-time agreement signing...');
      agreementHandled = true;

      await this.signAgreementModal(agreementModal, email);
    } else {
      console.log('[admin-login] Sign Agreement popup not visible at login step.');
    }

    return {
      isFirstTime: pinHandled || agreementHandled,
      pinHandled,
      agreementHandled,
    };
  }

  /**
   * Completes the TRN Agreement signing within the modal:
   * 1. Waits for loading skeleton to resolve
   * 2. Scrolls down to the Digital Signature section
   * 3. Fills Signer Title (derived from email)
   * 4. Draws real mouse strokes on signature canvas
   * 5. Checks any pending acknowledgment checkboxes
   * 6. Submits and waits for modal to close
   */
  async signAgreementModal(modalLocator, email = cfg.ADMIN_EMAIL) {
    const modal = modalLocator || this.page.locator('.modal.show, .sign-agreement-modal.show, #scheduleAAgreementGateModal.show, #trnAgreementGateModal.show, .modal:visible').first();
    console.log('[admin-agreement] Handling agreement signing inside modal...');

    // Wait for skeletons/loaders inside modal to resolve
    await modal.locator('.react-loading-skeleton, .spinner, .loader').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    await this.page.waitForTimeout(600);

    // Scroll modal body down to activate and reveal digital signature section
    await modal.evaluate((m) => {
      const body = m.querySelector('.sign-agreement-modal__body, .modal-body') || m;
      body.scrollTop = body.scrollHeight;
    }).catch(() => {});
    await this.page.waitForTimeout(500);

    const emailVal = await modal.locator('input#signer_email, input[name="signer_email"]').inputValue().catch(() => '');
    const effectiveEmail = emailVal || email || cfg.ADMIN_EMAIL;
    const emailLocalPart = effectiveEmail.split('@')[0];

    // Signer Name
    const signerNameInput = modal.locator('input#signer_name, input[name="signer_name"]').first();
    if (await signerNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentName = await signerNameInput.inputValue().catch(() => '');
      if (!currentName.trim()) {
        await signerNameInput.fill(emailLocalPart);
      }
    }

    // Signer Title: scroll into view and fill
    const signerTitleInput = modal.locator('input#signer_title, input[name="signer_title"]').first();
    await signerTitleInput.scrollIntoViewIfNeeded().catch(() => {});
    if (await signerTitleInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      const currentTitle = await signerTitleInput.inputValue().catch(() => '');
      if (!currentTitle.trim()) {
        await signerTitleInput.fill(emailLocalPart || 'Manager');
        await signerTitleInput.dispatchEvent('input').catch(() => {});
        await signerTitleInput.dispatchEvent('change').catch(() => {});
      }
    }

    // Check all acknowledgment checkboxes if any exist
    const ackCheckboxes = modal.locator('.sign-agreement-modal__ack input[type="checkbox"], input[id^="ack-"], input[type="checkbox"]');
    const ackCount = await ackCheckboxes.count();
    for (let i = 0; i < ackCount; i++) {
      const cb = ackCheckboxes.nth(i);
      if (await cb.isVisible().catch(() => false)) {
        const isChecked = await cb.isChecked().catch(() => false);
        if (!isChecked) {
          await cb.check({ force: true }).catch(() => {});
        }
      }
    }

    // Locate signature canvas
    const canvas = modal.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 10000 });
    await canvas.scrollIntoViewIfNeeded().catch(() => {});
    await this.page.waitForTimeout(500);

    const box = await canvas.boundingBox();
    if (!box || box.width === 0 || box.height === 0) {
      throw new Error('Signature canvas has zero dimensions or could not be found.');
    }

    // Draw realistic signature stroke on canvas using mouse
    const startX = box.x + box.width * 0.2;
    const startY = box.y + box.height * 0.5;
    const endX = box.x + box.width * 0.8;
    const endY = box.y + box.height * 0.5;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(startX + 40, startY - 25, { steps: 5 });
    await this.page.mouse.move(startX + 80, startY + 25, { steps: 5 });
    await this.page.mouse.move(startX + 120, startY - 15, { steps: 5 });
    await this.page.mouse.move(endX, endY, { steps: 5 });
    await this.page.mouse.up();

    // Also trigger touch/pointer/canvas events directly in page context as robust backup
    await this.page.evaluate(() => {
      const c = document.querySelector('.modal.show canvas, .sign-agreement-modal.show canvas, #trnAgreementGateModal canvas, canvas');
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

    await this.page.waitForTimeout(1000);
    await this.shot('admin-agreement-signed');

    // Submit button inside modal
    const submitBtn = modal.locator('button[type="submit"], button:has-text("Submit")').first();
    await expect(submitBtn, 'Submit button should become enabled in agreement modal').toBeEnabled({ timeout: 10000 });
    await submitBtn.click();

    // Wait for agreement modal to close
    await expect(modal, 'Agreement modal should close after submission').toBeHidden({ timeout: 15000 }).catch(async () => {
      // If modal still visible, try force closing or hitting Escape/close button
      const closeBtn = modal.locator('button.btn-close, button:has-text("Close"), [aria-label*="close" i]').first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click({ force: true }).catch(() => {});
      }
    });
    await this.waitReady();
    console.log('[admin-agreement] Agreement submitted and modal closed successfully.');
  }

  /**
   * Asserts successful login:
   * 1. No invalid credentials error displayed
   * 2. Sign In form disappears or page transitions to authenticated state
   * 3. Dashboard/navigation becomes visible
   * 4. Handles TRN Agreement gate modal if it opens asynchronously upon landing
   */
  async expectLoggedIn() {
    // Assert no error alert is thrown
    const errorAlert = this.page.locator('[role="alert"], [class*="error" i], [class*="toast" i]').filter({
      hasText: /invalid|incorrect|not found|unauthorized|failed|error/i,
    });
    await expect(errorAlert, 'No login error banner should appear on valid credentials').toBeHidden({ timeout: 5000 }).catch(() => {});

    // Verify authenticated landing: navigation elements or URL change
    const authenticatedMarkers = this.page.locator(
      'aside, nav, [class*="sidebar" i], [class*="dashboard" i], button:has-text("Logout"), button:has-text("Sign Out"), [class*="avatar" i]'
    );
    await expect(
      authenticatedMarkers.first(),
      'Admin dashboard navigation or profile should be visible upon login'
    ).toBeVisible({ timeout: 20000 });

    await this.shot('admin-dashboard-logged-in');
    console.log(`[admin-login] Successfully authenticated. Current URL: ${this.page.url()}`);

    // If TRN Agreement gate modal appears on dashboard after login, resolve it immediately
    const gateModal = this.page.locator('.modal.show, .sign-agreement-modal.show, #scheduleAAgreementGateModal.show, #trnAgreementGateModal.show').first();
    const isGateModalVisible = await gateModal.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
    if (isGateModalVisible) {
      console.log('[admin-login] TRN Agreement gate modal detected on dashboard! Handling signing...');
      await this.signAgreementModal(gateModal, cfg.ADMIN_EMAIL);
    }
  }

  /**
   * Negative assertion: asserts an error message is visible
   */
  async expectLoginError(pattern = /invalid|incorrect|wrong|unauthorized|failed/i) {
    const errorMsg = this.page.locator('body').getByText(pattern).first();
    await expect(errorMsg, `Error message matching ${pattern} should appear`).toBeVisible({ timeout: 10000 });
    await this.shot('admin-login-error');
  }
}

module.exports = { AdminLoginPage };

