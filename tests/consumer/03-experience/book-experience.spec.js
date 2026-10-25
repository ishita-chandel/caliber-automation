const { test, expect } = require('../../../fixtures/consumer.fixtures');
const { markInbox, fetchOtp } = require('../../../utils/otp-helper');

const TEST_EMAIL = 'test@mailinator.com';
const EXPERIENCE_NAME = 'Experience 1792591703979';
const PRODUCT_NAME = 'Product 1792591703979';
const QUANTITY = 1;
const EXPECTED_TOTAL = '$80.00';

const TEST_CARD = {
  number: '4242424242424242',
  exp: '02/45',
  cvc: '111',
};

test.describe.serial('Book Experience / Class Flow', () => {
  // Common login step reusable across tests.
  // After OTP verification, the app lands on /profile, loads profile/cart, and automatically redirects to /overview.
  // We wait for the app to complete this post-login transition and reach /overview.
  async function performLogin(auth, context, page) {
    await auth.openLogin();
    await auth.fillEmail(TEST_EMAIL);

    const marker = await markInbox(context, TEST_EMAIL);
    await auth.submitForOtp();

    const otp = await fetchOtp(context, TEST_EMAIL, marker);
    await auth.enterOtp(otp);
    await auth.expectLoggedIn();

    // App routes to /profile initially then auto-redirects to /overview once session/subscriptions load.
    // Wait for /overview or navigate directly if it doesn't auto-redirect within 10s.
    try {
      await page.waitForURL(/.*overview/, { timeout: 10000 });
    } catch {
      await page.goto('https://calibercard.yatilabs.com/overview', { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/.*overview/, { timeout: 15000 });
    }

    await expect(page).toHaveURL(/.*overview/);
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  // =========================================================================
  // Test Case A: Empty Card Details — Negative
  // =========================================================================
  test('Negative: Empty card details blocks payment and displays validation', async ({
    auth,
    experience,
    checkoutPage,
    context,
    page,
  }) => {
    test.setTimeout(240000);

    await test.step('1. Login via OTP and reach Overview', async () => {
      await performLogin(auth, context, page);
      // Save session so subsequent serial tests in fresh contexts or runs can reuse it
      await context.storageState({ path: '.auth/user.json' }).catch(() => {});
    });

    await test.step('2. Navigate to Experience and filter All', async () => {
      await experience.gotoExperiencePage();
      await experience.filterAll();
    });

    await test.step(`3. Search and select "${EXPERIENCE_NAME}"`, async () => {
      await experience.searchAndSelectExperience(EXPERIENCE_NAME);
    });

    await test.step(`4. Select product "${PRODUCT_NAME}" with quantity ${QUANTITY} and Reserve spot`, async () => {
      await experience.selectProductAndQuantity(PRODUCT_NAME, QUANTITY);
      await experience.clickReserveSpot();
    });

    await test.step('5. Verify checkout details before payment', async () => {
      await checkoutPage.verifyBookingSummary({
        experienceName: EXPERIENCE_NAME,
        productName: PRODUCT_NAME,
        quantity: QUANTITY,
        totalAmount: EXPECTED_TOTAL,
      });
    });

    await test.step('6. Leave card details empty and submit payment', async () => {
      await checkoutPage.submitEmptyPayment();
    });

    await test.step('7. Verify payment is blocked and validation is displayed', async () => {
      await checkoutPage.verifyPaymentBlockedValidation();
    });
  });

  // =========================================================================
  // Test Case B: Successful Stripe Test Payment — Positive
  // =========================================================================
  test('Positive: Complete Experience booking with valid Stripe test card', async ({
    auth,
    experience,
    checkoutPage,
    context,
    page,
  }) => {
    test.setTimeout(240000);

    // Verify session or login if new context
    await test.step('1. Ensure logged in and on Experience page', async () => {
      // Check if logged in by looking for token or navigating to overview
      const hasAuth = await page.evaluate(() => !!localStorage.getItem('@calibercard-frontend:token')).catch(() => false);
      if (!hasAuth) {
        await performLogin(auth, context, page);
      } else {
        await page.goto('https://calibercard.yatilabs.com/overview', { waitUntil: 'domcontentloaded' }).catch(() => {});
      }
      await experience.gotoExperiencePage();
      await experience.filterAll();
    });

    await test.step(`2. Search and select "${EXPERIENCE_NAME}"`, async () => {
      await experience.searchAndSelectExperience(EXPERIENCE_NAME);
    });

    await test.step(`3. Select product "${PRODUCT_NAME}" with quantity ${QUANTITY} and Reserve spot`, async () => {
      await experience.selectProductAndQuantity(PRODUCT_NAME, QUANTITY);
      await experience.clickReserveSpot();
    });

    await test.step('4. Verify order details on checkout page', async () => {
      await checkoutPage.verifyBookingSummary({
        experienceName: EXPERIENCE_NAME,
        productName: PRODUCT_NAME,
        quantity: QUANTITY,
        totalAmount: EXPECTED_TOTAL,
      });
    });

    await test.step('5. Fill Stripe test card and complete payment', async () => {
      await checkoutPage.completeStripePayment(TEST_CARD);
    });

    await test.step('6. Verify payment confirmation and return to Dashboard', async () => {
      await checkoutPage.verifyBookingConfirmation();
      await checkoutPage.clickDashboardAndVerifyOverview();
    });
  });
});

