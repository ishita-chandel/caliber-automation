const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');

/**
 * Page object for Cart & Checkout Page
 * URL: https://calibercard.yatilabs.com/cart
 */
class CheckoutPage extends BasePage {
  constructor(page) {
    super(page);
    this.completePaymentBtn = page.locator('button').filter({ hasText: /complete payment/i }).first();
    this.confirmationModal = page.locator('text=Booking Successful').or(page.locator('text=Your reservation has been successfully processed'));
    this.dashboardBtn = page.getByRole('button', { name: 'DASHBOARD' }).or(page.locator('button:has-text("DASHBOARD")')).first();
  }

  /**
   * Verify booking details displayed in the checkout summary
   */
  async verifyBookingSummary({ rangeName, skillLevel, firearm, notes, participantEmail, experienceName, productName, quantity, totalAmount }) {
    await this.page.waitForTimeout(2000);
    const body = this.page.locator('body');

    if (rangeName) {
      await expect(body).toContainText(/RSVP Booking/i);
    }
    if (experienceName) {
      await expect(body).toContainText(experienceName);
    }
    if (productName) {
      await expect(body).toContainText(productName);
    }
    if (quantity !== undefined) {
      await expect(body).toContainText(new RegExp(`(?:Qty:\\s*${quantity}|${quantity}\\s*×)`, 'i'));
    }
    if (totalAmount) {
      await expect(this.page.locator(`text=${totalAmount}`).first()).toBeVisible({ timeout: 10000 });
    }
    if (skillLevel) {
      await expect(body).toContainText(skillLevel);
    }
    if (firearm) {
      await expect(body).toContainText(firearm);
    }
    if (notes) {
      await expect(body).toContainText(notes);
    }
    if (participantEmail) {
      await expect(body).toContainText(participantEmail);
    }
  }

  /**
   * Attempt payment submission without filling card details (Negative test)
   */
  async submitEmptyPayment() {
    await expect(this.completePaymentBtn).toBeVisible({ timeout: 10000 });
    await this.completePaymentBtn.click();
  }

  /**
   * Verify payment was blocked with field or toast validation (Negative test)
   */
  async verifyPaymentBlockedValidation() {
    // Check for error class on field wrappers or Toastify error message
    const errorToast = this.page.locator('.Toastify__toast--error, [class*="toast--error"]');
    const fieldError = this.page.locator('.form-field--error, [class*="form-field--error"]');

    const hasToast = await errorToast.first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasFieldError = await fieldError.first().isVisible({ timeout: 5000 }).catch(() => false);

    expect(hasToast || hasFieldError, 'Expected validation error (toast or field error) when submitting empty payment').toBeTruthy();

    // Verify page did NOT redirect to confirmation or show success modal
    await expect(this.confirmationModal.first()).toBeHidden();
    expect(this.page.url()).toContain('/cart');
  }

  /**
   * Fill Stripe test card fields inside hosted Stripe iframes and complete payment
   */
  async completeStripePayment({ number, exp, cvc }) {
    // Locate Stripe iframes
    const cardNumFrame = this.page.frameLocator('iframe[name*="__privateStripeFrame"][src*="cardNumber"], iframe[title*="card number" i]');
    const cardExpiryFrame = this.page.frameLocator('iframe[name*="__privateStripeFrame"][src*="cardExpiry"], iframe[title*="expiration" i]');
    const cardCvcFrame = this.page.frameLocator('iframe[name*="__privateStripeFrame"][src*="cardCvc"], iframe[title*="cvc" i], iframe[title*="security code" i]');

    // Fill Card Number
    const cardNumInput = cardNumFrame.locator('input[name="cardnumber"], input[autocomplete="cc-number"]');
    await expect(cardNumInput, 'Stripe Card Number input should be visible').toBeVisible({ timeout: 15000 });
    await cardNumInput.fill(number);

    // Fill Expiry Date
    const cardExpInput = cardExpiryFrame.locator('input[name="exp-date"], input[autocomplete="cc-exp"]');
    await expect(cardExpInput, 'Stripe Expiry input should be visible').toBeVisible({ timeout: 10000 });
    await cardExpInput.fill(exp);

    // Fill CVC
    const cardCvcInput = cardCvcFrame.locator('input[name="cvc"], input[autocomplete="cc-csc"]');
    await expect(cardCvcInput, 'Stripe CVC input should be visible').toBeVisible({ timeout: 10000 });
    await cardCvcInput.fill(cvc);

    await this.page.waitForTimeout(500);

    // Submit payment
    await expect(this.completePaymentBtn).toBeEnabled({ timeout: 10000 });
    await this.completePaymentBtn.click();
  }

  /**
   * Verify confirmation popup appears after payment processing and return confirmation ID if present
   */
  async verifyBookingConfirmation() {
    await expect(this.confirmationModal.first()).toBeVisible({ timeout: 35000 });
    await expect(this.page.locator('text=Booking Successful').or(this.page.locator('text=Membership Purchased')).first()).toBeVisible();
    await expect(this.page.locator('text=Your reservation has been successfully processed').or(this.page.locator('text=Your order has been completed')).first()).toBeVisible();

    const bodyText = await this.page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
    const idMatch = bodyText.match(/Confirmation:\s*(#[A-Z0-9]+)/i) || bodyText.match(/Order\s*(#[A-Z0-9]+)/i) || bodyText.match(/(#[A-Z0-9]{8,})/i);
    const confirmationId = idMatch ? idMatch[1] : null;
    if (confirmationId) {
      console.log(`\n========================================`);
      console.log(`[Reserve Booking Confirmation ID]: ${confirmationId}`);
      console.log(`========================================\n`);
    }
    return confirmationId;
  }

  /**
   * Click DASHBOARD button on the confirmation modal and verify navigation to /overview
   */
  async clickDashboardAndVerifyOverview() {
    await expect(this.dashboardBtn).toBeVisible({ timeout: 10000 });
    await this.dashboardBtn.click();
    await this.page.waitForURL(/.*overview/, { timeout: 15000 });
    await expect(this.page).toHaveURL(/.*overview/);
  }
}

module.exports = { CheckoutPage };
