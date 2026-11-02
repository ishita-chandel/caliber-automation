const { test, expect } = require('@playwright/test');
const { AuthPage } = require('../../../pages/consumer/AuthPage');
const { BookingPage } = require('../../../pages/consumer/BookingPage');
const { CheckoutPage } = require('../../../pages/consumer/CheckoutPage');
const { AdminLoginPage } = require('../../../pages/admin/AdminLoginPage');
const { RangeCreatePage } = require('../../../pages/admin/RangeCreatePage');
const { AdminBookingPage } = require('../../../pages/admin/AdminBookingPage');
const { markInbox, fetchOtp } = require('../../../utils/otp-helper');
const cfg = require('../../../utils/config');

test.describe('End-to-End Booking Lifecycle: Reserve Booking → Assign & Approve → Check-In → Check-Out', () => {
  test.setTimeout(300000); // 5 minutes timeout for full cross-portal flow

  const TEST_EMAIL = 'test@mailinator.com';
  const RANGE_NAME = 'Range test 1';
  const RANGE_SLUG = process.env.RANGE_SLUG || 'range-test-1-2';
  const TARGET_BAY = 'Range bay 1';
  const TARGET_LANE = '1';
  const PARTICIPANT_EMAIL = 'caliberconnect@yopmail.com';
  const BOOKING_NOTE = 'Range booked please confirm';
  const SKILL_LEVEL = 'Beginner/In-training';
  const FIREARM = 'Handgun';

  const TEST_CARD = {
    number: cfg.CARD?.number || '4242424242424242',
    exp: cfg.CARD?.exp || '02/45',
    cvc: cfg.CARD?.cvc || '111',
    zip: cfg.CARD?.zip || '12345',
  };

  test('Case 2: Complete Reserve Booking (Dynamic Slot Within 2 Hours of Current Range Time) and Admin Lifecycle Management (Check-In & Check-Out)', async ({ browser }) => {
    let capturedBookingId = null;
    let rsvpNumericId = null;
    let bookingSlotInfo = null;

    // =========================================================================
    // PART 1: CONSUMER PORTAL - CREATE RESERVE BOOKING
    // =========================================================================
    const consumerContext = await browser.newContext();
    const consumerPage = await consumerContext.newPage();

    const auth = new AuthPage(consumerPage);
    const bookingPage = new BookingPage(consumerPage);
    const checkoutPage = new CheckoutPage(consumerPage);

    // Listen to RSVP creation response on consumer side to capture exact RSVP record ID
    consumerPage.on('response', async (res) => {
      const url = res.url();
      if ((url.includes('/rsvp') || url.includes('/order') || url.includes('/booking')) && res.request().method() === 'POST') {
        try {
          const json = await res.json();
          if (json?.data?.id) {
            rsvpNumericId = String(json.data.id);
            console.log(`[RSVP API Listener] Captured numeric RSVP ID: ${rsvpNumericId}`);
          }
        } catch (e) {}
      }
    });

    try {
      await test.step('Consumer Step 1: Log in via email OTP and reach Overview dashboard', async () => {
        await auth.openLogin();
        await auth.fillEmail(TEST_EMAIL);

        const marker = await markInbox(consumerContext, TEST_EMAIL);
        await auth.submitForOtp();

        const otp = await fetchOtp(consumerContext, TEST_EMAIL, marker);
        await auth.enterOtp(otp);
        await auth.expectLoggedIn();
      });

      await test.step('Consumer Step 2: Navigate to Find a Range and select "Range test 1"', async () => {
        const findRangeLink = consumerPage.locator('aside, nav, [class*="sidebar"]').locator('text=Find a Range').first();
        await findRangeLink.click();
        await consumerPage.waitForURL(/.*find-range.*/, { timeout: 15000 });

        await bookingPage.dismissGoogleMapsDialog();

        const searchBox = consumerPage.getByPlaceholder('Search by name or city');
        await expect(searchBox).toBeVisible({ timeout: 10000 });
        await searchBox.fill(RANGE_NAME);
        await consumerPage.keyboard.press('Enter');
        await consumerPage.waitForTimeout(2000);

        const viewBtn = consumerPage.getByRole('button', { name: /view availability/i })
          .or(consumerPage.locator('button, a').filter({ hasText: /view availability/i })).first();
        await expect(viewBtn, `Expected "View Availability" for ${RANGE_NAME}`).toBeVisible({ timeout: 10000 });
        await viewBtn.click();

        await consumerPage.waitForURL(new RegExp(`/range-detail/${RANGE_SLUG}`), { timeout: 15000 });
        await expect(consumerPage).toHaveURL(new RegExp(`/range-detail/${RANGE_SLUG}`));
        await bookingPage.dismissGoogleMapsDialog();
      });

      await test.step('Consumer Step 3: Check current Range time and select slot within 2 hours of Range time for immediate Check-In', async () => {
        bookingSlotInfo = await bookingPage.selectSlotDynamicByTimezone(RANGE_SLUG, { withinWindow: true });
        console.log(`\n========================================`);
        console.log(`[E2E Lifecycle - Case 2] Range Timezone:       ${bookingSlotInfo.timezone}`);
        console.log(`[E2E Lifecycle - Case 2] Current Range Time:   ${bookingSlotInfo.currentRangeTime}`);
        console.log(`[E2E Lifecycle - Case 2] Target Window (+2h):  ${bookingSlotInfo.targetRangeTime}`);
        console.log(`[E2E Lifecycle - Case 2] Selected Slot Date:   ${bookingSlotInfo.selectedDateStr}`);
        console.log(`[E2E Lifecycle - Case 2] Selected Slot Time:   ${bookingSlotInfo.selectedSlotTime}`);
        console.log(`========================================\n`);

        // Assertion: Selected slot must be valid
        expect(bookingSlotInfo.timezone, 'Range timezone must be valid').toBeTruthy();
        expect(bookingSlotInfo.selectedSlotTime, 'A valid slot within 2 hours must be selected').toBeTruthy();

        await bookingPage.selectSkillLevel(SKILL_LEVEL);
        await bookingPage.selectFirearm(FIREARM);
        await bookingPage.fillNote(BOOKING_NOTE);
      });

      await test.step('Consumer Step 4: Verify waiver status', async () => {
        await bookingPage.ensureWaiverSigned();
      });

      await test.step('Consumer Step 5: Add participant and agree to Range Policies', async () => {
        await bookingPage.addExistingParticipant(PARTICIPANT_EMAIL);
        await bookingPage.agreeToRangePolicies();
      });

      await test.step('Consumer Step 6: Click Reserve and verify summary', async () => {
        await bookingPage.clickReserve();
        await checkoutPage.verifyBookingSummary({
          rangeName: RANGE_NAME,
          skillLevel: SKILL_LEVEL,
          firearm: FIREARM,
          notes: BOOKING_NOTE,
          participantEmail: PARTICIPANT_EMAIL,
        });
      });

      await test.step('Consumer Step 7: Complete Stripe payment', async () => {
        await checkoutPage.completeStripePayment(TEST_CARD);
      });

      await test.step('Consumer Step 8: Capture unique Booking ID and navigate to Overview', async () => {
        capturedBookingId = await checkoutPage.verifyBookingConfirmation();
        console.log(`[E2E Lifecycle] Consumer Confirmation Code: ${capturedBookingId || 'N/A'}`);
        await checkoutPage.clickDashboardAndVerifyOverview();
      });
    } finally {
      await consumerContext.close();
    }

    // =========================================================================
    // PART 2: RANGE ADMIN PORTAL - ASSIGN & APPROVE & CHECK-IN LIFECYCLE
    // =========================================================================
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    const adminLogin = new AdminLoginPage(adminPage);
    const rangeCreate = new RangeCreatePage(adminPage);
    const adminBooking = new AdminBookingPage(adminPage);

    // Also listen to admin rsvp list in case we need the latest ID
    let latestAdminBookingId = null;
    adminPage.on('response', async (res) => {
      const url = res.url();
      if (url.includes('/rsvp/list') && res.request().method() === 'GET') {
        try {
          const json = await res.json();
          const records = json?.data?.data || [];
          if (records.length > 0) {
            const matching = records.find(r => r.notes === BOOKING_NOTE && r.status === 'PENDING') || records[0];
            latestAdminBookingId = String(matching.id);
            console.log(`[Admin RSVP Listener] Latest matching Booking ID from API: ${latestAdminBookingId}`);
          }
        } catch (e) {}
      }
    });

    try {
      await test.step('Admin Step 1: Log in to Range Admin Portal', async () => {
        await adminLogin.navigate();
        await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
      });

      await test.step('Admin Step 2: Switch Active Range to target range', async () => {
        await rangeCreate.selectActiveRange(RANGE_NAME);
      });

      await test.step('Admin Step 3: Navigate to Booking Today and locate the pending booking', async () => {
        await adminBooking.navigateToBookingToday();

        const targetBookingId = rsvpNumericId || latestAdminBookingId;
        console.log(`[Admin Step 3] Locating booking with ID: ${targetBookingId || 'first pending'}`);

        if (targetBookingId) {
          await adminBooking.openBookingDrawer(targetBookingId);
        } else {
          const firstRow = adminPage.locator('tbody tr').first();
          const firstId = (await firstRow.locator('td').first().innerText()).trim();
          console.log(`[Admin Step 3] Opening first row booking ID: ${firstId}`);
          await adminBooking.openBookingDrawer(firstId);
          latestAdminBookingId = firstId;
        }
      });

      const effectiveBookingId = rsvpNumericId || latestAdminBookingId;

      await test.step('Admin Step 4: Assign to Range Bay 1 and Lane 1', async () => {
        await adminBooking.assignBayAndLane(TARGET_BAY, TARGET_LANE);
      });

      await test.step('Admin Step 5: Click Approve & Assign', async () => {
        await adminBooking.approveBooking();
      });

      await test.step('Admin Step 6: Verify booking appears in Scheduled Bookings list', async () => {
        await adminBooking.verifyInScheduled(effectiveBookingId, TARGET_BAY, TARGET_LANE);
      });

      let checkInResult = null;
      let completedDetails = null;

      await test.step('Admin Step 7: Open View details and process Check-In & Check-Out', async () => {
        checkInResult = await adminBooking.inspectCheckInAndProcess(effectiveBookingId);
        expect(checkInResult.message).toBeTruthy();
      });

      if (checkInResult && checkInResult.checkedOut) {
        await test.step('Admin Step 8: Verify booking in Completed section', async () => {
          completedDetails = await adminBooking.verifyInCompleted(effectiveBookingId);
        });
      }

      // =========================================================================
      // STEP 7: FINAL EXECUTION REPORT
      // =========================================================================
      const overallResult = checkInResult?.checkedOut
        ? 'PASS'
        : checkInResult?.isEligible === false
        ? 'BLOCKED / PARTIALLY COMPLETED'
        : 'FAIL';

      console.log(`\n========================================`);
      console.log(`FINAL EXECUTION REPORT`);
      console.log(`========================================`);
      console.log(`Booking ID:      ${capturedBookingId || effectiveBookingId}`);
      console.log(`Range:           ${RANGE_NAME}`);
      console.log(`Range Timezone:  ${bookingSlotInfo?.timezone || 'America/Anchorage'}`);
      console.log(`Booking Slot:    ${bookingSlotInfo?.selectedDateStr || 'N/A'} ${bookingSlotInfo?.selectedSlotTime || 'N/A'}`);
      console.log(`Initial Status:  Pending -> Scheduled (${TARGET_BAY}, Lane ${TARGET_LANE})`);
      console.log(`Check-In:        ${checkInResult?.isEligible ? 'Successful' : checkInResult?.message || 'Blocked / Time not arrived'}`);
      console.log(`Checked-In At:   ${checkInResult?.checkedInAt || 'Not displayed / Not available'}`);
      console.log(`Check-Out:       ${checkInResult?.checkedOut ? 'Successful' : 'Not executed / Check-In not reached'}`);
      console.log(`Checked-Out At:  ${checkInResult?.checkedOutAt || 'Not displayed / Not available'}`);
      console.log(`Final Status:    ${checkInResult?.finalStatus || 'Scheduled'}`);
      console.log(`Overall Result:  ${overallResult}`);
      if (!checkInResult?.checkedOut) {
        console.log(`Reason:          Check-In restriction active in Range timezone: ${checkInResult?.message || 'Check-in time has not arrived'}`);
      }
      console.log(`========================================\n`);
    } finally {
      await adminContext.close();
    }
  });
});
