const { test, expect } = require('../../../fixtures/consumer.fixtures');
const { markInbox, fetchOtp } = require('../../../utils/otp-helper');
const { parseSlotTime } = require('../../../utils/timezone-helper');

const TEST_EMAIL = 'test@mailinator.com';
const RANGE_NAME = 'Range test 1';
const RANGE_SLUG = process.env.RANGE_SLUG || 'range-test-1-2';
const PARTICIPANT_EMAIL = 'caliberconnect@yopmail.com';
const SKILL_LEVEL = 'Beginner/In-training';
const FIREARM = 'Handgun';
const BOOKING_NOTE = 'Range booked please confirm';

const TEST_CARD = {
  number: '4242424242424242',
  exp: '02/45',
  cvc: '111',
};

test.describe('Consumer Reserve Booking End-to-End', () => {
  test('Complete flow: OTP login, Range selection, RSVP reservation, Participant addition, Stripe test payment, and Dashboard verification', async ({
    auth,
    bookingPage,
    checkoutPage,
    context,
    page,
  }) => {
    test.setTimeout(240000);

    // ==========================================
    // STEP 1: Consumer Login and OTP
    // ==========================================
    await test.step('Step 1: Login via email OTP and reach Overview dashboard', async () => {
      await auth.openLogin();
      await auth.fillEmail(TEST_EMAIL);

      const marker = await markInbox(context, TEST_EMAIL);
      await auth.submitForOtp();

      const otp = await fetchOtp(context, TEST_EMAIL, marker);
      await auth.enterOtp(otp);
      await auth.expectLoggedIn();

      // Navigate to /overview and verify dashboard loads
      await page.goto('https://calibercard.yatilabs.com/overview', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/.*overview/);
    });

    // ==========================================
    // STEP 2: Find and Select Range
    // ==========================================
    await test.step('Step 2: Navigate to Find a Range and select "Range test 1"', async () => {
      const findRangeLink = page.locator('aside, nav, [class*="sidebar"]').locator('text=Find a Range').first();
      await findRangeLink.click();
      await page.waitForURL(/.*find-range.*/, { timeout: 15000 });

      // Dismiss Google Maps modal if present
      await bookingPage.dismissGoogleMapsDialog();

      // Search by exact name
      const searchBox = page.getByPlaceholder('Search by name or city');
      await expect(searchBox).toBeVisible({ timeout: 10000 });
      await searchBox.fill(RANGE_NAME);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2000);

      // Verify matching result and open details page
      const viewBtn = page.getByRole('button', { name: /view availability/i })
        .or(page.locator('button, a').filter({ hasText: /view availability/i })).first();
      await expect(viewBtn, `Expected "View Availability" for ${RANGE_NAME}`).toBeVisible({ timeout: 10000 });
      await viewBtn.click();

      // Verify range details URL
      await page.waitForURL(new RegExp(`/range-detail/${RANGE_SLUG}`), { timeout: 15000 });
      await expect(page).toHaveURL(new RegExp(`/range-detail/${RANGE_SLUG}`));
      await bookingPage.dismissGoogleMapsDialog();
    });

    // ==========================================
    // STEP 3: Select Reservation Details (Dynamic Range Timezone Slot Calculation)
    // ==========================================
    let bookingSlotInfo = null;
    await test.step('Step 3: Dynamically calculate target time (+2h in Range timezone) and select valid slot', async () => {
      // Dynamically select available slot at or after Range current time + 2 hours
      bookingSlotInfo = await bookingPage.selectSlotDynamicByTimezone(RANGE_SLUG);

      // Logging for audit and debugging
      console.log(`\n========================================`);
      console.log(`[Reserve Booking] Range Timezone:          ${bookingSlotInfo.timezone}`);
      console.log(`[Reserve Booking] Current Range Time:      ${bookingSlotInfo.currentRangeTime}`);
      console.log(`[Reserve Booking] Calculated Target Time:  ${bookingSlotInfo.targetRangeTime}`);
      console.log(`[Reserve Booking] Selected Booking Date:   ${bookingSlotInfo.selectedDateStr}`);
      console.log(`[Reserve Booking] Selected Available Slot: ${bookingSlotInfo.selectedSlotTime}`);
      console.log(`========================================\n`);

      // Assertions verifying slot selection criteria
      expect(bookingSlotInfo.timezone, 'Range timezone must be defined').toBeTruthy();
      expect(bookingSlotInfo.selectedSlotTime, 'A valid slot must be selected').toBeTruthy();

      // If booking is on today's date in range local time, verify slot is at or after target time
      const targetDatePart = bookingSlotInfo.targetRangeTime.split(' ')[0];
      if (bookingSlotInfo.selectedDateStr === targetDatePart) {
        const targetTimePart = bookingSlotInfo.targetRangeTime.split(' ')[1];
        const targetParsed = parseSlotTime(targetTimePart);
        const selectedParsed = parseSlotTime(bookingSlotInfo.selectedSlotTime);

        if (targetParsed && selectedParsed) {
          expect(
            selectedParsed.totalMinutes,
            `Selected slot (${bookingSlotInfo.selectedSlotTime}) must be >= target time (${targetTimePart}) on date ${bookingSlotInfo.selectedDateStr}`
          ).toBeGreaterThanOrEqual(targetParsed.totalMinutes);
        }
      }

      // Select Skill Level
      await bookingPage.selectSkillLevel(SKILL_LEVEL);

      // Select Firearm
      await bookingPage.selectFirearm(FIREARM);

      // Fill Note
      await bookingPage.fillNote(BOOKING_NOTE);
    });

    // ==========================================
    // STEP 4: Waiver Verification and Signing
    // ==========================================
    await test.step('Step 4: Check waiver status and sign if required', async () => {
      await bookingPage.ensureWaiverSigned();
    });

    // ==========================================
    // STEP 5: Add Participant and Agree to Policies
    // ==========================================
    await test.step('Step 5: Add existing participant and check Range Policies agreement', async () => {
      await bookingPage.addExistingParticipant(PARTICIPANT_EMAIL);
      await bookingPage.agreeToRangePolicies();
    });

    // ==========================================
    // STEP 6: Reserve and Verify Checkout Cart
    // ==========================================
    await test.step('Step 6: Click Reserve and verify booking details on Cart page', async () => {
      await bookingPage.clickReserve();

      // Verify checkout details
      await checkoutPage.verifyBookingSummary({
        rangeName: RANGE_NAME,
        skillLevel: SKILL_LEVEL,
        firearm: FIREARM,
        notes: BOOKING_NOTE,
        participantEmail: PARTICIPANT_EMAIL,
      });
    });

    // ==========================================
    // STEP 7: Stripe Test Payment
    // ==========================================
    await test.step('Step 7: Complete payment using Stripe test card details', async () => {
      await checkoutPage.completeStripePayment(TEST_CARD);
    });

    // ==========================================
    // STEP 8: Confirmation and Return to Dashboard
    // ==========================================
    await test.step('Step 8: Verify booking confirmation popup and return to Dashboard', async () => {
      const confirmationId = await checkoutPage.verifyBookingConfirmation();
      console.log(`[Test Result] Reserve Booking Confirmation ID: ${confirmationId || 'N/A'}`);
      await checkoutPage.clickDashboardAndVerifyOverview();
    });
  });
});

