const { test, expect } = require('../../../fixtures/admin.fixtures');
const cfg = require('../../../utils/config');
const { generateRangeData } = require('../../../utils/data-factory');

const rangeAddressData = {
  address: '78 Main Street',
  country: 'United States',
  state: 'Texas',
  city: 'Houston',
  zipCode: '77001',
  latitude: '29.7604',
  longitude: '-95.3698',
};

test.describe('Range Admin - Create Range Flow', () => {
  test.beforeEach(async ({ adminLogin }) => {
    await adminLogin.navigate();
    await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
    await adminLogin.expectLoggedIn();
  });

  test('positive: create new range through all steps and finalize', async ({ rangeCreate }) => {
    test.setTimeout(300_000);

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

    const categoryData = {
      categoryName: 'Test Category Default',
      description: 'Category created for testing',
      type: 'RSVP',
      active: true,
      featured: false,
    };

    const waiverData = {
      adultRules: 'I agree to follow all range safety rules and instructions.',
      adultConsent: 'I understand the risks and agree to participate voluntarily.',
      minorRules: 'I agree to follow all range safety rules under adult supervision.',
      minorConsent: 'My parent or guardian has given permission for me to participate.',
    };

    const policyText = 'I agree to follow all range safety rules and instructions.';

    const rangeBayData = {
      name: 'Test Range Bay 01',
      description: 'Automated testing for range bay creation',
      guestReservationDayOut: '7',
      memberReservationDayOut: '14',
      status: 'AVAILABLE',
      bayType: 'FIREARM',
      category: 'Test Category Default',
      sessionDuration: '30 Minutes',
      numberOfLanes: '2',
      onlineReservations: true,
      laneSelection: true,
    };

    // Part 1: Range Creation Wizard
    await test.step('navigate to Settings > Locations > Add Range', async () => {
      await rangeCreate.navigateViaMenu();
    });

    await test.step('fill Step 1: General fields and save', async () => {
      await rangeCreate.fillGeneralDetails(rangeData);
      await rangeCreate.clickSave('General');
    });

    await test.step('handle Step 2: Agreements - sign Schedule A digitally and save', async () => {
      await rangeCreate.handleAgreementsStep();
    });

    await test.step('handle Step 3: Address - fill address and save', async () => {
      await rangeCreate.handleAddressStep(rangeAddressData);
    });

    await test.step('handle Step 4: Features - select all features and save', async () => {
      await rangeCreate.handleFeaturesStep();
    });

    await test.step('handle Step 5: Banner and Logo - skip', async () => {
      await rangeCreate.skipBannerAndLogo();
    });

    await test.step('handle Step 6: Manage Ranges - skip', async () => {
      await rangeCreate.skipManageRanges();
    });

    await test.step('handle Step 7: Instructors - skip', async () => {
      await rangeCreate.skipInstructors();
    });

    await test.step('complete remaining wizard steps and final save', async () => {
      await rangeCreate.completeWizard();
    });

    await test.step('verify range creation completed successfully', async () => {
      await rangeCreate.expectRangeCreated(rangeData.name);
    });

    // Part 2: Select Created Range in Header
    await test.step('select newly created Range in Active Range dropdown', async () => {
      await rangeCreate.selectActiveRange(rangeData.name);
    });

    // Part 3: Guest & Member Pricing
    await test.step('configure guest and member pricing ($10 / $5)', async () => {
      await rangeCreate.configurePricing('10', '5');
    });

    // Part 4: Default RSVP Category
    await test.step('create default RSVP category "Test Category Default"', async () => {
      await rangeCreate.createDefaultRsvpCategory(categoryData);
    });

    // Part 5: Operation Hours Mon-Fri
    await test.step('configure Monday-Friday operation hours (12:00 AM to 11:45 PM)', async () => {
      await rangeCreate.configureOperationHours();
    });

    // Part 6: Adult and Minor Waivers
    await test.step('configure Adult and Minor Waivers', async () => {
      await rangeCreate.configureWaivers(waiverData);
    });

    // Part 7: Range Policies
    await test.step('configure Range Policy and Range Membership Policy', async () => {
      await rangeCreate.configureRangePolicies(policyText);
    });

    // Part 8: Range Bay Creation
    await test.step('create Range Bay with 2 lanes', async () => {
      await rangeCreate.createRangeBay(rangeBayData);
    });

    // Part 9: Final Locations Verification
    await test.step('verify newly created Range appears in Locations list', async () => {
      await rangeCreate.verifyInLocations(rangeData.name);
    });

    // Print created Range name
    console.log('\n========================================');
    console.log(`[Created Range Name]: ${rangeData.name}`);
    console.log('========================================\n');
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

module.exports = { rangeAddressData };

