const { test, expect } = require('../../fixtures/test-fixtures');
const cfg = require('../../utils/config');
const { generateRangeData } = require('../../utils/data-factory');

test.describe('Range Admin - Create Range Flow', () => {
  test.beforeEach(async ({ adminLogin }) => {
    // 1. Authenticate with Range Admin credentials
    await adminLogin.navigate();
    await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
    await adminLogin.expectLoggedIn();
  });

  test('positive: create new range through all steps and finalize', async ({ rangeCreate }) => {
    test.setTimeout(120_000);

    // 2. Prepare structured test data for the General form
    const rangeData = generateRangeData({
      name: `Apex Range ${Date.now()}`,
      subHeading: 'Premier Training & Target Lanes',
      description: 'Full-service shooting range equipped with automated target retrieval systems, private tactical bays, and certified instructor coaching.',
      phone: '5552345678',
      email: cfg.ADMIN_EMAIL,
      website: 'https://apexrange.com',
      shotproPartner: true,
      nssfPartner: true,
      usccaPartner: true,
      firearm: true,
      archery: false,
      gunTypes: ['Handgun', 'Long Gun', 'Suppressed'],
    });

    // 3. Navigate via Settings > Locations > Add Range
    await test.step('navigate to Settings > Locations > Add Range', async () => {
      await rangeCreate.navigateViaMenu();
    });

    // 4. Fill in Step 1: General form & Save
    await test.step('fill Step 1: General fields and save', async () => {
      await rangeCreate.fillGeneralDetails(rangeData);
      await rangeCreate.clickSave('General');
    });

    // 5. Step 2: Agreements - Sign Schedule A digitally & Save
    await test.step('handle Step 2: Agreements - sign schedule a digitally and save', async () => {
      await rangeCreate.handleAgreementsStep();
    });

    // 6. Step 3: Address - Fill 78 main street canada & Save
    await test.step('handle Step 3: Address - fill "78 main street canada" and save', async () => {
      await rangeCreate.handleAddressStep('78 main street canada');
    });

    // 7. Steps 4-9: Skip for all remaining steps and save
    await test.step('skip remaining steps (Features, Banner, Ranges, Instructors, Hours, Social) and finalize', async () => {
      await rangeCreate.skipRemainingSteps();
    });

    // 8. Verify Range Creation
    await test.step('verify range creation completed successfully', async () => {
      await rangeCreate.expectRangeCreated(rangeData.name);
    });
  });

  test('negative: validate required fields on empty submission', async ({ rangeCreate }) => {
    await test.step('navigate to Settings > Locations > Add Range', async () => {
      await rangeCreate.navigateViaMenu();
    });

    await test.step('clear pre-filled email and submit without filling required fields', async () => {
      await rangeCreate.clearGeneralFields();
      await rangeCreate.clickSave('empty submission');
    });

    await test.step('verify validation errors prevent form submission and stay on Step 1', async () => {
      await rangeCreate.expectValidationErrors();
    });
  });

  test('negative: reject submission with invalid email format', async ({ rangeCreate }) => {
    await test.step('navigate to Settings > Locations > Add Range', async () => {
      await rangeCreate.navigateViaMenu();
    });

    await test.step('fill general form with invalid email address', async () => {
      const invalidData = generateRangeData({
        name: `Invalid Email Range ${Date.now()}`,
        email: 'invalid-email-format-without-at',
      });
      await rangeCreate.fillGeneralDetails(invalidData);
      await rangeCreate.clickSave('invalid email');
    });

    await test.step('verify validation prevents advancement to next step', async () => {
      await rangeCreate.expectValidationErrors(/email|valid|format|enter/i);
    });
  });
});
