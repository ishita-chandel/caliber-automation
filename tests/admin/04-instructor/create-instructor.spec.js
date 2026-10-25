const { test, expect } = require('../../../fixtures/admin.fixtures');
const cfg = require('../../../utils/config');
const { createUniqueInstructorData } = require('../../../utils/data-factory');

// ═══════════════════════════════════════════════════════════════════════════
// Range Admin – Create Instructor Flow
// Positive (TC01) & 4 Essential Negative Cases (TC02 - TC05)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Range Admin – Create Instructor Flow', () => {
  test.beforeEach(async ({ adminLogin }) => {
    // 1. Log in to Range Admin and verify the Dashboard
    await adminLogin.navigate();
    await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
    await adminLogin.expectLoggedIn();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // POSITIVE TEST CASES
  // ═══════════════════════════════════════════════════════════════════════

  test('TC01 - positive: successfully create an instructor with valid data and verify in listing', async ({
    instructorPage,
  }) => {
    test.setTimeout(120_000);

    const data = createUniqueInstructorData({
      firstName: 'Aarav',
      password: 'Test@12345',
      dateOfBirth: '05/15/1995',
      gender: 'Male',
      zipCode: '10001',
      type: 'Rover',
      skillLevel: 'Beginner/In-training',
      bio: 'Certified firearms instructor with experience in firearm safety, range procedures, beginner training, and responsible handling. Focused on providing safe and structured training sessions for members.',
      avatar: null, // Avatar is optional
    });

    const fullName = `${data.firstName} ${data.lastName}`;

    await test.step('navigate to Settings > Instructor', async () => {
      await instructorPage.navigateViaMenu();
    });

    await test.step('click Add, then click Add New in popup', async () => {
      await instructorPage.clickAdd();
      await instructorPage.clickAddNew();
    });

    await test.step('fill in instructor details and click Save', async () => {
      await instructorPage.fillInstructorDetails(data);
      await instructorPage.saveAndExpectSuccess();
    });

    await test.step('verify instructor appears in listing with correct name, email, and skill level', async () => {
      await instructorPage.verifyInstructorInList(fullName);
      await instructorPage.verifyInstructorRowDetails({
        fullName,
        email: data.email,
        skillLevel: data.skillLevel,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // NEGATIVE TEST CASES (4 ONLY)
  // ═══════════════════════════════════════════════════════════════════════

  // ── TC02: Missing First Name ─────────────────────────────────────────
  test('TC02 - negative: submit form with empty First Name - verify required validation', async ({
    instructorPage,
  }) => {
    test.setTimeout(90_000);

    const data = createUniqueInstructorData({ firstName: '' });

    await test.step('navigate to Settings > Instructor', async () => {
      await instructorPage.navigateViaMenu();
    });

    await test.step('click Add, then Add New', async () => {
      await instructorPage.clickAdd();
      await instructorPage.clickAddNew();
    });

    await test.step('fill instructor details leaving First Name empty and click Save', async () => {
      await instructorPage.fillInstructorDetails(data);
      await instructorPage.clickSave();
    });

    await test.step('verify validation error keeps modal open and instructor is not created', async () => {
      await instructorPage.expectValidationError();
      await instructorPage.closeButton().click();
      await instructorPage.expectInstructorNotInList(data.email);
    });
  });

  // ── TC03: Missing Last Name ──────────────────────────────────────────
  test('TC03 - negative: submit form with empty Last Name - verify required validation', async ({
    instructorPage,
  }) => {
    test.setTimeout(90_000);

    const data = createUniqueInstructorData({ lastName: '' });

    await test.step('navigate to Settings > Instructor', async () => {
      await instructorPage.navigateViaMenu();
    });

    await test.step('click Add, then Add New', async () => {
      await instructorPage.clickAdd();
      await instructorPage.clickAddNew();
    });

    await test.step('fill instructor details leaving Last Name empty and click Save', async () => {
      await instructorPage.fillInstructorDetails(data);
      await instructorPage.clickSave();
    });

    await test.step('verify validation error keeps modal open and instructor is not created', async () => {
      await instructorPage.expectValidationError();
      await instructorPage.closeButton().click();
      await instructorPage.expectInstructorNotInList(data.email);
    });
  });

  // ── TC04: Invalid Email Format ───────────────────────────────────────
  test('TC04 - negative: submit form with invalid email format - verify validation message', async ({
    instructorPage,
  }) => {
    test.setTimeout(90_000);

    const data = createUniqueInstructorData({
      email: 'invalid-email-format-without-at',
    });

    await test.step('navigate to Settings > Instructor', async () => {
      await instructorPage.navigateViaMenu();
    });

    await test.step('click Add, then Add New', async () => {
      await instructorPage.clickAdd();
      await instructorPage.clickAddNew();
    });

    await test.step('fill instructor details with invalid email format and click Save', async () => {
      await instructorPage.fillInstructorDetails(data);
      await instructorPage.clickSave();
    });

    await test.step('verify validation error keeps modal open and instructor is not created', async () => {
      await instructorPage.expectValidationError();
      await instructorPage.closeButton().click();
      await instructorPage.expectInstructorNotInList(data.email);
    });
  });

  // ── TC05: Missing Required Password ──────────────────────────────────
  test('TC05 - negative: submit form with empty required Password - verify validation', async ({
    instructorPage,
  }) => {
    test.setTimeout(90_000);

    const data = createUniqueInstructorData({ password: '' });

    await test.step('navigate to Settings > Instructor', async () => {
      await instructorPage.navigateViaMenu();
    });

    await test.step('click Add, then Add New', async () => {
      await instructorPage.clickAdd();
      await instructorPage.clickAddNew();
    });

    await test.step('fill instructor details leaving Password empty and click Save', async () => {
      await instructorPage.fillInstructorDetails(data);
      await instructorPage.clickSave();
    });

    await test.step('verify validation error keeps modal open and instructor is not created', async () => {
      await instructorPage.expectValidationError();
      await instructorPage.closeButton().click();
      await instructorPage.expectInstructorNotInList(data.email);
    });
  });
});

