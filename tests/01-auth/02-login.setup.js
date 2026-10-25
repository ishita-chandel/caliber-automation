const fs = require('fs');
const path = require('path');
const { test } = require('../../fixtures/test-fixtures');
const cfg = require('../../utils/config');
const { loadUser } = require('../../utils/data-factory');
const { markInbox, fetchOtp } = require('../../utils/otp-helper');

// Runs SECOND. Logs in the signup user with a fresh OTP and saves the session (.auth/user.json),
// so RSVP / Experience tests start already logged in.
test('login: existing user with email OTP, save session', async ({ auth, context }) => {
  const user = loadUser();
  console.log(`[login] user: ${user.email} (${user.provider})`);

  await test.step('open login and enter email', async () => {
    await auth.openLogin();
    await auth.fillEmail(user.email);
  });

  const marker = await test.step('remember current inbox state', () => markInbox(context, user.email));

  await test.step('request OTP', () => auth.submitForOtp());

  const otp = await test.step('read NEW OTP from inbox', () => fetchOtp(context, user.email, marker));
  console.log(`[login] OTP received: ${otp}`);

  await test.step('enter OTP', async () => {
    await auth.enterOtp(otp);
    await auth.expectLoggedIn();
  });

  fs.mkdirSync(path.dirname(cfg.AUTH_FILE), { recursive: true });
  await context.storageState({ path: cfg.AUTH_FILE });
});
