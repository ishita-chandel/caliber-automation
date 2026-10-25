const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');

/**
 * Page object for Range Detail & Booking Form (RSVP)
 * URL: https://calibercard.yatilabs.com/range-detail/{rangeSlug}
 */
class BookingPage extends BasePage {
  constructor(page) {
    super(page);
    this.guestTab = page.locator('button, div').filter({ hasText: /^Guest/ }).first();
    this.memberTab = page.locator('button, div').filter({ hasText: /^Member/ }).first();
    this.skillDropdownTrigger = page.locator('div, button').filter({ hasText: /Select Skill Level/i }).last();
    this.firearmDropdownTrigger = page.locator('div, button').filter({ hasText: /Select Firearm/i }).last();
    this.noteInput = page.locator('textarea, input[placeholder*="note" i], [name="note"]').first();
    this.addParticipantBtn = page.getByRole('button', { name: /add participant/i }).or(page.locator('button:has-text("Add Participant")')).first();
    this.policyAgreementCheckbox = page.locator('input[type="checkbox"][name="agreed"]');
    this.policyAgreementLabel = page.locator('label.cc-chk-label, label, span').filter({ hasText: /range policies/i }).first();
    this.reserveBtn = page.locator('button.cc-btn-request, button').filter({ hasText: /^reserve$/i }).first();
  }

  /** Navigate to range detail page directly */
  async gotoRange(rangeSlug) {
    await this.page.goto(`https://calibercard.yatilabs.com/range-detail/${rangeSlug}`, { waitUntil: 'domcontentloaded' });
    await this.dismissGoogleMapsDialog();
  }

  /** Dismiss Google Maps error modal if displayed */
  async dismissGoogleMapsDialog() {
    const okBtn = this.page.getByRole('button', { name: 'OK' });
    if (await okBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await okBtn.click();
    }
  }

  /** Switch to Guest tab if Member tab requires membership */
  async ensureGuestTabActive() {
    if (await this.guestTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await this.guestTab.click();
      await this.page.waitForTimeout(1000);
    }
  }

  /** Select today's date chip, or next available date if today has no slots */
  async selectTodayDate() {
    await this.dismissGoogleMapsDialog();
    const availableChip = this.page.locator('.cc-daychip:not(.disabled)').first();
    if (await availableChip.isVisible({ timeout: 5000 }).catch(() => false)) {
      await availableChip.click({ force: true });
    } else {
      const todayChip = this.page.locator('.cc-daychip').first();
      await expect(todayChip).toBeVisible({ timeout: 10000 });
      await todayChip.click({ force: true });
    }
    await this.page.waitForTimeout(500);
    await this.dismissGoogleMapsDialog();
  }

  /**
   * Selects the first available (not disabled) time slot for today.
   * If today has no available slots, fails with a clear message or inspects rendered availability.
   * Returns the selected slot time string.
   */
  async selectFirstAvailableSlot() {
    const availableSlots = this.page.locator('.cc-slot:not(.disabled)');
    const count = await availableSlots.count();
    
    if (count === 0) {
      // Check if today has no slots and let's check next day chip if necessary
      const dayChips = this.page.locator('.cc-daychip:not(.disabled)');
      const dayCount = await dayChips.count();
      if (dayCount > 1) {
        console.log('[BookingPage] Today has no available slots, selecting next available date');
        await dayChips.nth(1).click();
        await this.page.waitForTimeout(1000);
      }
    }

    const firstSlot = this.page.locator('.cc-slot:not(.disabled)').first();
    await expect(firstSlot, 'Expected at least one available time slot to be visible').toBeVisible({ timeout: 10000 });
    const slotTime = (await firstSlot.innerText()).trim();
    await firstSlot.click();
    await this.page.waitForTimeout(500);
    return slotTime;
  }

  /** Select skill level from custom dropdown */
  async selectSkillLevel(skillText = 'Beginner/In-training') {
    await this.skillDropdownTrigger.waitFor({ state: 'visible', timeout: 10000 });
    await this.skillDropdownTrigger.click();
    await this.page.waitForTimeout(400);

    const option = this.page.locator('li, [role="option"], div').filter({ hasText: new RegExp(`^${skillText}$`, 'i') }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(400);
  }

  /** Select firearm type from custom dropdown */
  async selectFirearm(firearmText = 'Handgun') {
    await this.firearmDropdownTrigger.waitFor({ state: 'visible', timeout: 10000 });
    await this.firearmDropdownTrigger.click();
    await this.page.waitForTimeout(400);

    const option = this.page.locator('li, [role="option"], div').filter({ hasText: new RegExp(`^${firearmText}$`, 'i') }).first();
    await expect(option).toBeVisible({ timeout: 5000 });
    await option.click();
    await this.page.waitForTimeout(400);
  }

  /** Fill booking note */
  async fillNote(noteText = 'Range booked please confirm') {
    await this.noteInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.noteInput.fill(noteText);
  }

  /**
   * Verify waiver status.
   * If not already signed, signs the waiver via canvas signature and submits.
   */
  async ensureWaiverSigned() {
    const waiverCompletedBadge = this.page.locator('.badge, span, div').filter({ hasText: /waiver completed|waiver signed/i }).first();
    if (await waiverCompletedBadge.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[BookingPage] Waiver is already completed for the primary user.');
      return;
    }

    const signWaiverBtn = this.page.getByRole('button', { name: /sign waiver/i });
    if (await signWaiverBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signWaiverBtn.click();
      await this.page.waitForSelector('canvas', { timeout: 10000 });

      // Draw signature on canvas
      const canvas = this.page.locator('canvas').first();
      const box = await canvas.boundingBox();
      if (box) {
        const startX = box.x + box.width / 4;
        const startY = box.y + box.height / 2;
        await this.page.mouse.move(startX, startY);
        await this.page.mouse.down();
        await this.page.mouse.move(startX + 80, startY - 20, { steps: 5 });
        await this.page.mouse.move(startX + 140, startY + 20, { steps: 5 });
        await this.page.mouse.up();
      }

      // Check acknowledgment checkbox if present
      const ackCheckbox = this.page.locator('input[type="checkbox"]').filter({ hasText: /acknowledge/i })
        .or(this.page.getByRole('checkbox', { name: /acknowledge/i })).first();
      if (await ackCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        await ackCheckbox.check();
      }

      // Submit waiver
      const submitBtn = this.page.getByRole('button', { name: /submit|sign/i }).first();
      await submitBtn.click();
      await this.page.waitForTimeout(1500);
    }
  }

  /**
   * Add existing participant by searching email
   */
  async addExistingParticipant(participantEmail = 'caliberconnect@yopmail.com') {
    await this.addParticipantBtn.waitFor({ state: 'visible', timeout: 10000 });
    await this.addParticipantBtn.click();
    await this.page.waitForTimeout(800);

    // Click "Search Existing" tab in modal
    const searchExistingTab = this.page.locator('button, div, [role="tab"]').filter({ hasText: /^Search Existing$/i }).first();
    await expect(searchExistingTab).toBeVisible({ timeout: 5000 });
    await searchExistingTab.click();
    await this.page.waitForTimeout(600);

    // Type in search box and wait for API response
    const searchInput = this.page.locator('#search, input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    
    const searchResponsePromise = this.page.waitForResponse(
      (resp) => resp.url().includes('/api/v1/users') && resp.status() === 200,
      { timeout: 15000 }
    ).catch(() => null);

    await searchInput.fill(participantEmail);
    await searchResponsePromise;
    await this.page.waitForTimeout(1000);

    // Locate participant profile card (wait for actual result to appear, not the searching placeholder)
    const resultCard = this.page.locator('.profile-info:has-text("' + participantEmail + '"), [class*="profile-info"]:has-text("' + participantEmail + '")').first();
    await expect(resultCard, `Participant card for ${participantEmail} should be found in search results`).toBeVisible({ timeout: 15000 });
    await resultCard.click();

    // Verify modal automatically closes or close button clicked
    await this.page.locator('.modal-overlay').waitFor({ state: 'hidden', timeout: 5000 }).catch(async () => {
      const closeModalBtn = this.page.locator('button[aria-label*="close" i], button:has-text("×"), button.modal-close, button.close').first();
      if (await closeModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeModalBtn.click();
      }
    });

    // Verify participant is added to Shooters list
    await this.page.waitForTimeout(1000);
    const addedShooter = this.page.locator('.cc-shooters-list, [class*="shooter"], body').locator('text=' + participantEmail).first();
    await expect(addedShooter, `Expected participant ${participantEmail} to appear in Shooters list`).toBeVisible({ timeout: 10000 });
  }

  /**
   * Check "I agree to Range Policies" checkbox
   */
  async agreeToRangePolicies() {
    await this.page.evaluate(() => {
      const chk = document.querySelector('input[name="agreed"]');
      if (chk) {
        chk.click();
        chk.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await expect(this.policyAgreementCheckbox).toBeChecked({ timeout: 5000 });
  }

  /**
   * Click Reserve button and wait for Cart/Checkout navigation
   */
  async clickReserve() {
    await expect(this.reserveBtn).toBeEnabled({ timeout: 10000 });
    await this.reserveBtn.click();
    await this.page.waitForURL(/.*cart/, { timeout: 20000 });
    await this.page.waitForLoadState('domcontentloaded');
  }
}

module.exports = { BookingPage };
