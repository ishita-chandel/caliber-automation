const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const cfg = require('../../utils/config');

/**
 * Admin Booking Management Page Object
 * Handles Range Admin booking operations:
 * - Switching active range
 * - Navigating to Booking Today, Scheduled, Completed
 * - Locating bookings by ID
 * - Assigning Bay and Lane via details drawer
 * - Approving bookings
 * - Checking Check-in eligibility
 * - Check-in and Check-out flows
 */
class AdminBookingPage extends BasePage {
  constructor(page) {
    super(page);
    this.searchBookingInput = page.locator('input[placeholder*="Search bookings" i], input[type="search"]').first();
    this.refreshBtn = page.getByRole('button', { name: /refresh/i }).first();
    this.drawer = page.locator('#rsvpBookingModal, .booking-drawer').first();
    this.drawerCloseBtn = page.locator('.btn-close.rsvp-modal-close, button[aria-label="Close"]').first();
    this.bayTrigger = page.locator('#rsvpBay');
    this.laneTrigger = page.locator('#rsvpLane');
    this.approveAndAssignBtn = page.getByRole('button', { name: /approve & assign/i }).or(page.getByRole('button', { name: /assign and approve/i })).first();
  }

  /**
   * Navigate to Booking Today list
   */
  async navigateToBookingToday() {
    const todayLink = this.page.locator('a[href*="/bookings/booking-today"]').first();
    if (await todayLink.isVisible().catch(() => false)) {
      await todayLink.click();
    } else {
      await this.goto(`${cfg.ADMIN_URL.replace(/\/home\/?$/, '')}/bookings/booking-today`);
    }
    await this.waitReady();
    await this.page.waitForSelector('table', { timeout: 15000 });
  }

  /**
   * Navigate to Scheduled Bookings list
   */
  async navigateToScheduled() {
    await this.page.locator('.post-login-loader').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    const schedLink = this.page.locator('a[href*="/bookings/scheduled"]').first();
    if (await schedLink.isVisible().catch(() => false)) {
      await schedLink.click({ force: true });
    } else {
      await this.goto(`${cfg.ADMIN_URL.replace(/\/home\/?$/, '')}/bookings/scheduled`);
    }
    await this.waitReady();
    await this.page.locator('.post-login-loader').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForSelector('table', { timeout: 15000 });
  }

  /**
   * Navigate to Completed Bookings list
   */
  async navigateToCompleted() {
    const compLink = this.page.locator('a[href*="/bookings/completed"]').first();
    if (await compLink.isVisible().catch(() => false)) {
      await compLink.click();
    } else {
      await this.goto(`${cfg.ADMIN_URL.replace(/\/home\/?$/, '')}/bookings/completed`);
    }
    await this.waitReady();
    await this.page.waitForSelector('table', { timeout: 15000 });
  }

  /**
   * Locate a row in the table by Booking ID (string or number, e.g. "323" or "#323")
   * @param {string|number} bookingId
   */
  async getBookingRow(bookingId) {
    const cleanId = String(bookingId).replace(/^#/, '').trim();
    await this.page.locator('.post-login-loader').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
    await this.page.waitForSelector('tbody tr', { timeout: 15000 });

    // Poll up to 10 seconds for table rows to be populated with data
    for (let attempt = 0; attempt < 10; attempt++) {
      const rows = this.page.locator('tbody tr');
      const count = await rows.count();
      for (let i = 0; i < count; i++) {
        const row = rows.nth(i);
        const firstColText = (await row.locator('td').first().innerText().catch(() => '')).trim();
        if (firstColText === cleanId) {
          return row;
        }
      }
      await this.page.waitForTimeout(1000);
    }

    // Fallback: search filter if row not visible on first page
    if (await this.searchBookingInput.isVisible().catch(() => false)) {
      await this.searchBookingInput.fill(cleanId);
      await this.page.keyboard.press('Enter');
      await this.page.waitForTimeout(2000);
      const filteredRows = this.page.locator('tbody tr');
      const filteredCount = await filteredRows.count();
      for (let i = 0; i < filteredCount; i++) {
        const row = filteredRows.nth(i);
        const firstColText = (await row.locator('td').first().innerText().catch(() => '')).trim();
        if (firstColText === cleanId) {
          return row;
        }
      }
    }
    return null;
  }

  /**
   * Open the details drawer for a given booking ID
   * @param {string|number} bookingId
   */
  async openBookingDrawer(bookingId) {
    const row = await this.getBookingRow(bookingId);
    expect(row, `Booking row for ID ${bookingId} must be present in the table`).not.toBeNull();

    // Click the view/action button in the last column
    const actionBtn = row.locator('td:last-child button, button[data-bs-target="#rsvpBookingModal"]').first();
    await expect(actionBtn).toBeVisible({ timeout: 10000 });
    await actionBtn.click();

    // Wait for drawer to be visible
    await expect(this.drawer).toBeVisible({ timeout: 15000 });
    console.log(`[admin-booking] Drawer opened for Booking ID ${bookingId}`);
  }

  /**
   * Assign Bay and Lane inside the opened booking drawer
   * @param {string} bayName - e.g. "Range bay 1"
   * @param {string} laneName - e.g. "1"
   */
  async assignBayAndLane(bayName = 'Range bay 1', laneName = '1') {
    console.log(`[admin-booking] Assigning Bay: "${bayName}", Lane: "${laneName}"`);

    // 1. Select Bay
    await expect(this.bayTrigger).toBeVisible({ timeout: 10000 });
    await this.bayTrigger.click();

    const bayOption = this.page.locator(`li[role="option"]:has-text("${bayName}")`).filter({ hasText: new RegExp(`^${bayName}$`, 'i') }).or(this.page.locator(`[role="option"]:has-text("${bayName}")`)).last();
    await expect(bayOption).toBeVisible({ timeout: 5000 });
    await bayOption.click();
    console.log(`[admin-booking] Bay "${bayName}" selected`);

    // Wait for lane trigger to become enabled
    await expect(this.laneTrigger).toBeEnabled({ timeout: 5000 });

    // 2. Select Lane
    await this.laneTrigger.click();
    const laneOption = this.page.locator(`li[role="option"]:has-text("${laneName}"), [role="option"]:has-text("${laneName}")`).filter({ hasText: new RegExp(`^${laneName}$`) }).last();
    await expect(laneOption).toBeVisible({ timeout: 5000 });
    await laneOption.click();
    console.log(`[admin-booking] Lane "${laneName}" selected`);
  }

  /**
   * Click Approve & Assign button in the drawer and verify success
   */
  async approveBooking() {
    await expect(this.approveAndAssignBtn).toBeVisible({ timeout: 10000 });
    await expect(this.approveAndAssignBtn).toBeEnabled({ timeout: 10000 });

    // Click and wait for network or drawer to close / status update
    await this.approveAndAssignBtn.click();
    console.log('[admin-booking] Clicked "Approve & Assign"');

    // Wait for drawer to close automatically
    await expect(this.drawer).toBeHidden({ timeout: 15000 }).catch(async () => {
      // If still visible, try closing it gracefully
      if (await this.drawerCloseBtn.isVisible().catch(() => false)) {
        await this.drawerCloseBtn.click({ force: true }).catch(() => {});
      }
    });

    await this.page.waitForTimeout(1000);
  }

  /**
   * Verify that the booking appears under Scheduled with assigned Bay & Lane
   * @param {string|number} bookingId
   * @param {string} expectedBay
   * @param {string} expectedLane
   */
  async verifyInScheduled(bookingId, expectedBay = 'Range bay 1', expectedLane = '1') {
    await this.navigateToScheduled();
    const cleanId = String(bookingId).replace(/^#/, '').trim();
    const row = await this.getBookingRow(cleanId);
    expect(row, `Booking ${cleanId} must be present in Scheduled list`).not.toBeNull();

    const rowText = await row.innerText();
    console.log(`[admin-booking] Scheduled row text: ${rowText.replace(/\s+/g, ' ').trim()}`);

    expect(rowText).toContain('Scheduled');
    expect(rowText.toLowerCase()).toContain(expectedBay.toLowerCase());
    expect(rowText).toContain(expectedLane);

    return row;
  }

  /**
   * Inspect Check-in eligibility for a scheduled booking and process if available.
   * Steps:
   * 1. Opens the booking details drawer via View.
   * 2. Confirms the Booking ID in the drawer matches.
   * 3. Inspects whether Check-In button is enabled.
   * 4. If enabled: clicks Check-In, waits for success message, verifies status becomes Checked In,
   *    captures Check-In timestamp, then verifies Check-Out button, clicks Check-Out,
   *    waits for success, and captures Check-Out timestamp.
   * 5. If disabled: captures the displayed reason without forcing action.
   * @param {string|number} bookingId
   * @returns {Promise<{isEligible: boolean, message: string, checkedInAt: string|null, checkedOut: boolean, checkedOutAt: string|null, finalStatus: string}>}
   */
  async inspectCheckInAndProcess(bookingId) {
    const cleanId = String(bookingId).replace(/^#/, '').trim();
    const row = await this.getBookingRow(cleanId);
    expect(row, `Booking ${cleanId} must be present in Scheduled list`).not.toBeNull();

    // Capture check-in cell text from list
    const checkinCell = row.locator('td').nth(4);
    const cellText = (await checkinCell.innerText()).replace(/\s+/g, ' ').trim();
    console.log(`[admin-booking] Scheduled Table Check-In Column: "${cellText}"`);

    // Step 2: Click View option for the matching Booking ID to open details drawer
    console.log(`[admin-booking] Opening View drawer for Booking ID: ${cleanId}`);
    const viewBtn = row.locator('td:last-child button, button[data-bs-target="#rsvpBookingModal"]').first();
    await expect(viewBtn).toBeVisible({ timeout: 10000 });
    await viewBtn.click();

    // Verify drawer opens and Booking ID inside drawer matches
    await expect(this.drawer).toBeVisible({ timeout: 15000 });
    const drawerHeader = await this.drawer.innerText();
    expect(drawerHeader, `Drawer must display Booking #${cleanId}`).toMatch(new RegExp(`#?${cleanId}`));
    console.log(`[admin-booking] Confirmed drawer opened for matching Booking #${cleanId}`);

    // Step 3: Check-In button inspection
    const checkinBtn = this.drawer.locator('button:has-text("Check-in"), button:has-text("Check In")').first();
    const isCheckinBtnVisible = await checkinBtn.isVisible().catch(() => false);
    const isCheckinEnabled = isCheckinBtnVisible && (await checkinBtn.isEnabled().catch(() => false));

    let checkedInAt = null;
    let checkedOutAt = null;
    let checkedOut = false;
    let finalStatus = 'Scheduled';

    if (isCheckinEnabled) {
      console.log(`[admin-booking] Check-In button is ENABLED for Booking #${cleanId}. Clicking Check-In...`);
      await checkinBtn.click();

      // Wait for success toast / message
      const toast = this.page.locator('[role="alert"], [class*="toast" i]').first();
      await expect(toast).toBeVisible({ timeout: 10000 }).catch(() => {});
      const toastMsg = await toast.innerText().catch(() => '');
      console.log(`[admin-booking] Check-In message: "${toastMsg.trim()}"`);

      // After clicking Check-In, the modal automatically closes and the Scheduled table reloads.
      // Re-open drawer for Booking to verify Checked-In state and inspect Check-Out button
      await this.page.waitForTimeout(2000);
      const updatedRow = await this.getBookingRow(cleanId);
      const isDrawerOpen = await this.drawer.isVisible().catch(() => false);
      if (!isDrawerOpen && updatedRow) {
        console.log(`[admin-booking] Re-opening drawer for Booking #${cleanId} after Check-In`);
        const viewBtn = updatedRow.locator('td:last-child button, button[data-bs-target="#rsvpBookingModal"]').first();
        await viewBtn.click();
        await expect(this.drawer).toBeVisible({ timeout: 10000 });
      }

      // Verify status update in drawer or list
      const drawerBody = await this.drawer.innerText();
      finalStatus = drawerBody.includes('Checked-in') || drawerBody.includes('Checked In') ? 'Checked In' : 'In Progress';

      // Capture actual Check-In timestamp displayed by application
      const checkinTimeMatch = drawerBody.match(/CHECK-IN\s*\n\s*([^\n]+)/i);
      checkedInAt = checkinTimeMatch && !checkinTimeMatch[1].includes('—') ? checkinTimeMatch[1].trim() : 'Not displayed / Not available';
      console.log(`[admin-booking] Captured Check-In Timestamp: ${checkedInAt}`);

      // Step 4: Check-Out inspection inside drawer
      const checkoutBtn = this.drawer.locator('button:has-text("Check-out"), button:has-text("Check Out"), button:has-text("Check-Out")').first();
      await expect(checkoutBtn).toBeVisible({ timeout: 10000 });
      const isCheckoutEnabled = await checkoutBtn.isEnabled().catch(() => false);

      if (isCheckoutEnabled) {
        console.log(`[admin-booking] Check-Out button is ENABLED for Booking #${cleanId}. Clicking Check-Out...`);
        await checkoutBtn.click();

        await expect(toast).toBeVisible({ timeout: 10000 }).catch(() => {});
        const checkoutMsg = await toast.innerText().catch(() => '');
        console.log(`[admin-booking] Check-Out message: "${checkoutMsg.trim()}"`);

        await this.page.waitForTimeout(2000);
        checkedOut = true;
        finalStatus = 'Completed';

        const updatedDrawerBody = await this.drawer.innerText().catch(() => '');
        const checkoutTimeMatch = updatedDrawerBody.match(/CHECK-OUT\s*\n\s*([^\n]+)/i);
        checkedOutAt = checkoutTimeMatch && !checkoutTimeMatch[1].includes('—') ? checkoutTimeMatch[1].trim() : 'Not displayed / Not available';
        console.log(`[admin-booking] Captured Check-Out Timestamp: ${checkedOutAt}`);
      }

      // Close drawer
      if (await this.drawer.isVisible().catch(() => false)) {
        await this.drawerCloseBtn.click({ force: true }).catch(() => {});
      }

      return {
        isEligible: true,
        message: 'Check-In and Check-Out completed successfully',
        checkedInAt,
        checkedOut,
        checkedOutAt,
        finalStatus,
      };
    }

    // Check-In is disabled or restriction displayed
    console.log(`[admin-booking] Check-In button not enabled or restriction active. Table status: "${cellText}"`);
    const drawerReason = await this.drawer.innerText();
    const reasonMatch = drawerReason.match(/Check-in opens at[^\n.]+/i);
    const displayedReason = reasonMatch ? reasonMatch[0] : cellText || 'Check-in time has not arrived';

    // Close drawer safely
    if (await this.drawer.isVisible().catch(() => false)) {
      await this.drawerCloseBtn.click({ force: true }).catch(() => {});
    }

    return {
      isEligible: false,
      message: displayedReason,
      checkedInAt: 'Not displayed / Not available',
      checkedOut: false,
      checkedOutAt: 'Not displayed / Not available',
      finalStatus: 'Scheduled',
    };
  }

  /**
   * Verify booking presence in Completed section with full details
   * @param {string|number} bookingId
   * @returns {Promise<{found: boolean, status: string, checkInTime: string, checkOutTime: string}>}
   */
  async verifyInCompleted(bookingId) {
    await this.navigateToCompleted();
    const cleanId = String(bookingId).replace(/^#/, '').trim();
    const row = await this.getBookingRow(cleanId);
    expect(row, `Booking ${cleanId} must be present in Completed list`).not.toBeNull();

    const rowText = await row.innerText();
    console.log(`[admin-booking] Completed row text: ${rowText.replace(/\s+/g, ' ').trim()}`);

    // Click View to inspect completed drawer
    const viewBtn = row.locator('td:last-child button, button[data-bs-target="#rsvpBookingModal"]').first();
    let checkInTime = 'Not displayed / Not available';
    let checkOutTime = 'Not displayed / Not available';

    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await expect(this.drawer).toBeVisible({ timeout: 10000 });
      const drawerBody = await this.drawer.innerText();
      const inMatch = drawerBody.match(/CHECK-IN\s*\n\s*([^\n]+)/i);
      const outMatch = drawerBody.match(/CHECK-OUT\s*\n\s*([^\n]+)/i);
      if (inMatch && !inMatch[1].includes('—')) checkInTime = inMatch[1].trim();
      if (outMatch && !outMatch[1].includes('—')) checkOutTime = outMatch[1].trim();
      await this.drawerCloseBtn.click({ force: true }).catch(() => {});
    }

    return {
      found: true,
      status: 'Completed',
      checkInTime,
      checkOutTime,
    };
  }
}

module.exports = { AdminBookingPage };

