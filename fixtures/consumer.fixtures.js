const base = require('@playwright/test');
const { AuthPage } = require('../pages/consumer/AuthPage');
const { DashboardPage } = require('../pages/consumer/DashboardPage');
const { RsvpPage } = require('../pages/consumer/RsvpPage');
const { ExperiencePage } = require('../pages/consumer/ExperiencePage');
const { CartPage } = require('../pages/consumer/CartPage');
const { BookingPage } = require('../pages/consumer/BookingPage');
const { CheckoutPage } = require('../pages/consumer/CheckoutPage');
const { MembershipPage } = require('../pages/consumer/MembershipPage');

/**
 * Consumer-specific fixtures.
 * Usage: const { test, expect } = require('../../fixtures/consumer.fixtures');
 */
const test = base.test.extend({
  auth:        async ({ page }, use) => use(new AuthPage(page)),
  dashboard:   async ({ page }, use) => use(new DashboardPage(page)),
  rsvp:        async ({ page }, use) => use(new RsvpPage(page)),
  experience:  async ({ page }, use) => use(new ExperiencePage(page)),
  cart:        async ({ page }, use) => use(new CartPage(page)),
  bookingPage: async ({ page }, use) => use(new BookingPage(page)),
  checkoutPage:async ({ page }, use) => use(new CheckoutPage(page)),
  membershipPage: async ({ page }, use) => use(new MembershipPage(page)),
});

module.exports = { test, expect: base.expect };
