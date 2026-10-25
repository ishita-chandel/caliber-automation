const base = require('@playwright/test');
const { AuthPage } = require('../pages/consumer/AuthPage');
const { DashboardPage } = require('../pages/consumer/DashboardPage');
const { RsvpPage } = require('../pages/consumer/RsvpPage');
const { ExperiencePage } = require('../pages/consumer/ExperiencePage');
const { CartPage } = require('../pages/consumer/CartPage');
const { AdminLoginPage } = require('../pages/AdminLoginPage');
const { RangeCreatePage } = require('../pages/range-create');
const { ExperienceCreatePage } = require('../pages/experience-create');

/** Every test receives ready page objects:  test('..', async ({ auth, dashboard, rsvp, adminLogin, rangeCreate, expCreate }) => {...}) */
const test = base.test.extend({
  auth: async ({ page }, use) => use(new AuthPage(page)),
  dashboard: async ({ page }, use) => use(new DashboardPage(page)),
  rsvp: async ({ page }, use) => use(new RsvpPage(page)),
  experience: async ({ page }, use) => use(new ExperiencePage(page)),
  cart: async ({ page }, use) => use(new CartPage(page)),
  adminLogin: async ({ page }, use) => use(new AdminLoginPage(page)),
  rangeCreate: async ({ page }, use) => use(new RangeCreatePage(page)),
  expCreate: async ({ page }, use) => use(new ExperienceCreatePage(page)),
});

module.exports = { test, expect: base.expect };
