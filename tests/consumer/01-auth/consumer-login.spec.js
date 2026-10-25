/**
 * Consumer Portal – Login with Email OTP
 *
 * Portal : https://calibercard.yatilabs.com
 * Account: test111@yopmail.com
 *
 * Flow:
 *  1. Open the Consumer Portal home page.
 *  2. Dismiss cookie consent (if present).
 *  3. Click the LOGIN button → navigates to /signin.
 *  4. Enter test111@yopmail.com in the "Email or phone number" field.
 *  5. Capture a Yopmail inbox marker (remember the current top message).
 *  6. Click "GET CODE" to request the OTP.
 *  7. Poll Yopmail for the NEW email (ignores older messages).
 *  8. Extract the 4-digit OTP from the email body.
 *  9. Type the OTP into the four individual digit boxes (otp-0 … otp-3).
 * 10. Click "VERIFY & CONTINUE".
 * 11. Assert the OTP screen disappears and the authenticated page loads.
 */

const { test, expect } = require('../../../fixtures/consumer.fixtures');
const { markInbox, fetchOtp } = require('../../../utils/otp-helper');

const CONSUMER_EMAIL = process.env.CONSUMER_EMAIL || 'test@mailinator.com';

test.describe('Consumer Portal – Login with Email OTP', () => {
  test(
    'TC-CON-L01: login with valid email and real-time OTP',
    async ({ auth, context }) => {
      test.setTimeout(180_000); // OTP delivery + polling can take up to 60s

      await test.step('open Consumer Portal and navigate to Login', async () => {
        await auth.openLogin();
      });

      await test.step('enter email address', async () => {
        await auth.fillEmail(CONSUMER_EMAIL);
      });

      let marker;
      await test.step('capture inbox marker (record current top message)', async () => {
        marker = await markInbox(context, CONSUMER_EMAIL);
      });

      await test.step('request OTP via "GET CODE"', async () => {
        await auth.submitForOtp();
      });

      let otp;
      await test.step('fetch the NEW OTP from inbox (ignores old messages)', async () => {
        otp = await fetchOtp(context, CONSUMER_EMAIL, marker);
        // Never log the OTP value — only confirm it is a 4-digit string
        expect(otp, 'OTP must be a 4-digit string').toMatch(/^\d{4}$/);
      });

      await test.step('enter OTP and verify', async () => {
        await auth.enterOtp(otp);
        await auth.expectLoggedIn();
      });

      await test.step('assert authenticated page has loaded', async () => {
        // After login the consumer portal redirects to the home/dashboard
        // Confirm we are NOT on the /signin page
        await expect(auth.page, 'User should not be on the signin page after login')
          .not.toHaveURL(/\/signin/, { timeout: 15000 });
        // Confirm some dashboard/home element is visible
        const dashboardIndicator = auth.page
          .locator('[class*="dashboard"], [class*="home"], [class*="member"], nav, header')
          .first();
        await expect(dashboardIndicator, 'Authenticated page should have a navigation/header').toBeVisible({ timeout: 15000 });
      });
    },
  );
});

