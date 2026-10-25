const { test, expect } = require('../../../fixtures/consumer.fixtures');
const { markInbox, fetchOtp } = require('../../../utils/otp-helper');
const { getSmssNetNumber, markSmsInbox, fetchSmsOtp } = require('../../../utils/sms-helper');
const { generateRegistrationUser } = require('../../../utils/data-factory');

const MEMBERSHIP_NAME = 'Caliber Card Connect';

const TEST_CARD = {
  number: '4242424242424242',
  exp: '06/51',
  cvc: '222',
};

test.describe('Consumer Registration & Membership Purchase Flow', () => {
  test('Phase 1: Email-based registration and membership purchase', async ({
    membershipPage,
    checkoutPage,
    context,
    page,
  }) => {
    test.setTimeout(240000);

    const user = generateRegistrationUser();
    console.log(`[Test] Registering user: ${user.email} (${user.provider}) | Name: ${user.firstName} ${user.lastName}`);

    // Step 1: Open portal, click Join Now, and select membership
    await test.step('Step 1: Open portal and select membership', async () => {
      await membershipPage.openHome();
      await membershipPage.clickJoinNow();
      await membershipPage.selectMembership(MEMBERSHIP_NAME);
      await membershipPage.clickContinueFromMembership();
    });

    // Step 2: Enter email and verify OTP
    await test.step('Step 2: Enter email, request and verify OTP', async () => {
      await membershipPage.selectEmailTabAndEnter(user.email);
      const marker = await markInbox(context, user.email);
      await membershipPage.submitForOtp();
      const otp = await fetchOtp(context, user.email, marker);
      console.log(`[Test] Fetched OTP: ${otp}`);
      await membershipPage.enterOtp(otp);
      await membershipPage.expectOtpVerified();
    });

    // Step 3: Complete profile form
    await test.step('Step 3: Complete profile form', async () => {
      await membershipPage.fillProfileForm(user);
      await membershipPage.clickContinueFromProfile();
    });

    // Step 4: Eligibility page
    await test.step('Step 4: Answer eligibility questions', async () => {
      await membershipPage.answerEligibilityQuestions('No');
      await membershipPage.clickContinueFromEligibility();
    });

    // Step 5: Review page and agreement
    await test.step('Step 5: Review details and accept membership agreement', async () => {
      await membershipPage.verifyReviewPage({
        membershipName: MEMBERSHIP_NAME,
        email: user.email,
        phone: user.phone,
      });
      await membershipPage.checkAgreementAndPay();
    });

    // Step 6: Checkout validation
    await test.step('Step 6: Checkout validation', async () => {
      await membershipPage.verifyCheckoutSummary({
        membershipName: MEMBERSHIP_NAME,
        email: user.email,
      });
    });

    // Step 7: Stripe test payment
    await test.step('Step 7: Complete payment via Stripe test card', async () => {
      await checkoutPage.completeStripePayment(TEST_CARD);
    });

    // Step 8: Membership purchase confirmation & Dashboard
    await test.step('Step 8: Verify purchase confirmation and reach Overview dashboard', async () => {
      const orderId = await membershipPage.verifyMembershipConfirmation(MEMBERSHIP_NAME);
      console.log(`[Test] Purchase successful. Confirmation ID: ${orderId || 'N/A'}`);
      await membershipPage.clickDashboard();
    });
  });

  test('Phase 2: Phone-based registration and membership purchase', async ({
    membershipPage,
    checkoutPage,
    context,
  }) => {
    test.setTimeout(240000);

    const user = generateRegistrationUser();
    // Get US test phone number from smss.net randomly
    const testPhone = await getSmssNetNumber(context);
    user.phone = testPhone;

    console.log(`[Test] Registering user with phone: ${testPhone} | Name: ${user.firstName} ${user.lastName}`);

    // Step 1: Open portal, click Join Now, and select membership
    await test.step('Step 1: Open portal and select membership', async () => {
      await membershipPage.openHome();
      await membershipPage.clickJoinNow();
      await membershipPage.selectMembership(MEMBERSHIP_NAME);
      await membershipPage.clickContinueFromMembership();
    });

    // Step 2: Enter phone number and verify OTP
    await test.step('Step 2: Enter phone number, request and verify OTP', async () => {
      await membershipPage.selectPhoneTabAndEnter(testPhone);
      const marker = await markSmsInbox(context, testPhone);
      await membershipPage.submitForOtp();
      const otp = await fetchSmsOtp(context, testPhone, marker);
      console.log(`[Test] SMS OTP retrieved: ${otp}`);
      await membershipPage.enterOtp(otp);
      await membershipPage.expectOtpVerified();
    });

    // Step 3: Complete profile form
    await test.step('Step 3: Complete profile form', async () => {
      await membershipPage.fillProfileForm(user);
      await membershipPage.clickContinueFromProfile();
    });

    // Step 4: Eligibility page
    await test.step('Step 4: Answer eligibility questions', async () => {
      await membershipPage.answerEligibilityQuestions('No');
      await membershipPage.clickContinueFromEligibility();
    });

    // Step 5: Review page and agreement
    await test.step('Step 5: Review details and accept membership agreement', async () => {
      await membershipPage.verifyReviewPage({
        membershipName: MEMBERSHIP_NAME,
        phone: testPhone,
      });
      await membershipPage.checkAgreementAndPay();
    });

    // Step 6: Checkout validation
    await test.step('Step 6: Checkout validation', async () => {
      await membershipPage.verifyCheckoutSummary({
        membershipName: MEMBERSHIP_NAME,
      });
    });

    // Step 7: Stripe test payment
    await test.step('Step 7: Complete payment via Stripe test card', async () => {
      await checkoutPage.completeStripePayment(TEST_CARD);
    });

    // Step 8: Membership purchase confirmation & Dashboard
    await test.step('Step 8: Verify purchase confirmation and reach Overview dashboard', async () => {
      const confirmationId = await membershipPage.verifyMembershipConfirmation(MEMBERSHIP_NAME);
      console.log(`\n========================================`);
      console.log(`[Phase 2 Confirmation ID]: ${confirmationId || 'N/A'}`);
      console.log(`========================================\n`);
      expect(confirmationId, 'Confirmation ID must be displayed and captured').toBeTruthy();
      await membershipPage.clickDashboard();
    });
  });
});

