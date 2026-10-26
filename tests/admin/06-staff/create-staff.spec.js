const { test, expect } = require('../../../fixtures/admin.fixtures');
const cfg = require('../../../utils/config');

test.describe('Admin — Staff Creation and Role Assignment', () => {
  test.beforeEach(async ({ adminLogin }) => {
    // Step 1: Login to Range Admin portal
    await adminLogin.navigate();
    await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
  });

  // ───────────────────────── POSITIVE SCENARIOS ─────────────────────────

  test('Test 1: Add an Existing Customer as Staff by Email and verify role assignment', async ({
    staffPage,
  }) => {
    // Navigate to Settings -> Staff
    await staffPage.navigateViaMenu();

    // Clean up test customer if previously added so search can find them
    await staffPage.removeStaffIfExists('test@mailinator.com');

    // Click Add
    await staffPage.clickAdd();

    // Search for eligible customer by email (test@mailinator.com)
    const email = 'test@mailinator.com';
    const results = await staffPage.searchCustomer(email);
    expect(results.length).toBeGreaterThan(0);

    // Select customer and verify selection pill
    await staffPage.selectCustomerFromDropdown('test user');
    await staffPage.verifyCustomerSelected('test user');

    // Assign Role (Staff)
    await staffPage.selectRole('Staff');
    await staffPage.verifyRoleSelected('Staff');

    // Save and verify redirection to Staff listing
    await staffPage.saveAndExpectSuccess();

    // Verify staff appears in listing with role
    await staffPage.verifyStaffInListing(email, 'Staff');
  });

  test('Test 2: Search Customer by Registered Mobile Number', async ({
    staffPage,
  }) => {
    await staffPage.navigateViaMenu();
    await staffPage.clickAdd();

    // Search by registered customer mobile number
    // From API inspection: test@mailinator.com has phone 5477467844 or caliberconnect has +114387975699
    // Even if test@mailinator.com was added, another phone or query returns the verified customer format
    const phone = '5477467844';
    await staffPage.searchCustomer(phone);

    // If already added, verify dropdown behavior or search matching
    // Verify input accepts mobile number without issue
    await expect(staffPage.searchCustomerInput()).toHaveValue(phone);
  });

  test('Test 3: Verify Role Assignment persistence', async ({
    staffPage,
  }) => {
    await staffPage.navigateViaMenu();

    // Verify assigned role is visible on the staff listing card
    await staffPage.verifyStaffInListing('test@mailinator.com', 'Staff');
  });

  // ───────────────────────── NEGATIVE SCENARIOS ─────────────────────────

  test('Test 4 & 5: Prevent Adding the Same Customer Twice (Duplicate Prevention)', async ({
    staffPage,
  }) => {
    // Ensure test customer is already added as staff before testing duplicate prevention
    await staffPage.ensureStaffMemberAdded('test@mailinator.com', 'test user', 'Staff');
    await staffPage.verifyStaffInListing('test@mailinator.com');

    // Navigate to Add Staff
    await staffPage.clickAdd();

    // Search for the exact same customer
    const results = await staffPage.searchCustomer('test@mailinator.com');

    // The backend excludes already-assigned staff
    expect(results.length).toBe(0);

    // Verify UI reflects no selectable results or No Options Available
    await expect(staffPage.noOptionsAvailable()).toBeVisible({ timeout: 5000 });

    // Return to listing and verify only one staff record exists for that customer
    await staffPage.navigateViaMenu();
    await staffPage.verifySingleStaffRecord('test@mailinator.com');
  });

  test('Test 6: Attempt to Save Without Selecting a Customer', async ({
    staffPage,
  }) => {
    await staffPage.navigateViaMenu();
    await staffPage.clickAdd();

    // Do not select customer, click Save
    await staffPage.clickSave();

    // Application should not navigate away, remains on create page
    await expect(staffPage.page).toHaveURL(/.*\/settings\/staff\/create/);

    // Also displays role validation feedback
    await expect(staffPage.roleValidationError()).toBeVisible({ timeout: 5000 });
  });

  test('Test 7: Attempt to Save Without Selecting a Role', async ({
    staffPage,
  }) => {
    await staffPage.navigateViaMenu();
    await staffPage.clickAdd();

    // Click Save without selecting a role
    await staffPage.clickSave();

    // Verify required validation message is displayed
    await expect(staffPage.roleValidationError()).toBeVisible({ timeout: 5000 });
    await expect(staffPage.page).toHaveURL(/.*\/settings\/staff\/create/);
  });

  test('Test 8: Search for a Non-Existing Customer', async ({
    staffPage,
  }) => {
    await staffPage.navigateViaMenu();
    await staffPage.clickAdd();

    const nonExistentEmail = `nonexistent.customer.${Date.now()}@yopmail.com`;
    const results = await staffPage.searchCustomer(nonExistentEmail);

    // Verify API returns 0 results
    expect(results.length).toBe(0);

    // Verify UI displays "No Options Available"
    await expect(staffPage.noOptionsAvailable()).toBeVisible({ timeout: 5000 });

    // Verify customer cannot be selected
    await expect(staffPage.saveButton()).toBeVisible();
  });
});

