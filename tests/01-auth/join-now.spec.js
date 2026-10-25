const { test } = require('../../fixtures/test-fixtures');
const cfg = require('../../utils/config');
const { generateUser, saveUser, savedUserExists } = require('../../utils/data-factory');
const { markInbox, fetchOtp } = require('../../utils/otp-helper');

// Runs FIRST. Creates a brand new user, passes OTP, stores the user for login / rsvp / experience.
test('signup: new user with email OTP', async ({ auth, context }) => {
  test.skip(!!cfg.TEST_EMAIL, 'TEST_EMAIL is set in .env, using that existing user');
  test.skip(!cfg.FRESH_USER && savedUserExists(), 'FRESH_USER=false and a saved user exists, reusing it');

  const user = generateUser();
  console.log(`[signup] user: ${user.email} (${user.provider})`);

  await test.step('open signup and fill the form', async () => {
    await auth.openSignup();
    await auth.fillSignupForm(user);
  });

  const marker = await test.step('remember current inbox state', () => markInbox(context, user.email));

  await test.step('request OTP', () => auth.submitForOtp());

  const otp = await test.step('read OTP from inbox', () => fetchOtp(context, user.email, marker));
  console.log(`[signup] OTP received: ${otp}`);

  await test.step('enter OTP', async () => {
    await auth.enterOtp(otp);
    await auth.expectLoggedIn();
  });

  saveUser(user);
});
