// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const cfg = require('./utils/config');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 180_000, // OTP + payment flows are slow
  expect: { timeout: 15_000 },
  fullyParallel: false, // flows share one user + one OTP inbox, so keep them in order
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: cfg.CUSTOMER_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 45_000,
    launchOptions: { slowMo: cfg.SLOW_MO },
  },
  projects: [
    // ── CONSUMER ──────────────────────────────────────────────────────────
    // 1) Setup: signup then OTP login → saves session to .auth/user.json
    {
      name: 'setup',
      testMatch: /.*consumer.*\.setup\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
    // 2) Consumer flows: RSVP, Experience, Auth (reuse saved login session)
    {
      name: 'chromium',
      testMatch: /.*tests\/consumer\/.*/,
      testIgnore: [/.*\.setup\.js/, /.*consumer-login\.spec\.js/, /.*reserve-booking\.spec\.js/, /.*book-experience\.spec\.js/, /.*inspect-.*\.spec\.js/],
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], storageState: cfg.AUTH_FILE },
    },
    // 3) Consumer Login with OTP / Standalone flow — standalone, no saved session dependency
    {
      name: 'consumer-login',
      testMatch: [/.*consumer-login\.spec\.js/, /.*reserve-booking\.spec\.js/, /.*book-experience\.spec\.js/, /.*inspect-.*\.spec\.js/, /.*register-and-purchase\.spec\.js/],
      use: { ...devices['Desktop Chrome'] },
    },

    // ── ADMIN ─────────────────────────────────────────────────────────────
    // 4) Range Admin portal (no consumer session)
    {
      name: 'admin',
      testMatch: /.*tests\/admin\/.*/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
