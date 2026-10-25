const base = require('@playwright/test');
const { AdminLoginPage } = require('../pages/admin/AdminLoginPage');
const { RangeCreatePage } = require('../pages/admin/RangeCreatePage');
const { ExperienceCreatePage } = require('../pages/admin/ExperienceCreatePage');
const { InstructorPage } = require('../pages/admin/InstructorPage');
const { RolePage } = require('../pages/admin/RolePage');
const { StaffPage } = require('../pages/admin/StaffPage');

/**
 * Admin-specific fixtures.
 * Usage: const { test, expect } = require('../../fixtures/admin.fixtures');
 */
const test = base.test.extend({
  adminLogin:     async ({ page }, use) => use(new AdminLoginPage(page)),
  rangeCreate:    async ({ page }, use) => use(new RangeCreatePage(page)),
  expCreate:      async ({ page }, use) => use(new ExperienceCreatePage(page)),
  instructorPage: async ({ page }, use) => use(new InstructorPage(page)),
  rolePage:       async ({ page }, use) => use(new RolePage(page)),
  staffPage:      async ({ page }, use) => use(new StaffPage(page)),
});

module.exports = { test, expect: base.expect };

