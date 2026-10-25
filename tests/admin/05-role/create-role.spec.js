const { test, expect } = require('../../../fixtures/admin.fixtures');
const { createUniqueRoleData } = require('../../../utils/data-factory');
const cfg = require('../../../utils/config');

test.describe('Admin — Role Creation with Permissions', () => {
  test.beforeEach(async ({ adminLogin }) => {
    // 1. Log in to the Range Admin portal
    await adminLogin.navigate();
    await adminLogin.login(cfg.ADMIN_EMAIL, cfg.ADMIN_PASSWORD);
  });

  test('Create role with Full Access only to General Settings and verify persistence', async ({
    rolePage,
  }) => {
    const roleData = createUniqueRoleData();

    // 2. Navigate to Settings -> Roles
    await rolePage.navigateViaMenu();

    // 3 & 4. Click Add button and verify Create Role page opens
    await rolePage.clickAdd();

    // 5 & 6 & 7 & 8. Enter unique role name and proceed to permissions configuration
    await rolePage.enterRoleName(roleData.name);

    // 9. Configure permissions: Full Access only to General Settings, all others No Access
    await rolePage.configurePermissionsGeneralSettingsFullAccessOnly();

    // 10. Save role and verify navigation back to Roles listing
    await rolePage.saveRole();

    // 11 & 12. Verify role appears in listing
    await rolePage.verifyRoleInList(roleData.name);

    // Verify persisted permissions (by checking details/edit view)
    await rolePage.verifyRolePermissionsPersisted(roleData.name);
  });
});

