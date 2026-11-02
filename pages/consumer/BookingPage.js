const { expect } = require('@playwright/test');
const { BasePage } = require('../shared/BasePage');
const { calculateTargetSlotTime, parseSlotTime } = require('../../utils/timezone-helper');

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

  /**
   * Retrieves the configured Range Timezone by inspecting the range data.
   * Priority:
   * 1. Response of `/api/v1/customer/range/{slug}`
   * 2. Encrypted local storage `@calibercard-frontend` range data
   * 3. API direct query fallback using slug
   * Throws an error if timezone cannot be identified.
   */
  async getRangeTimezone(rangeSlug) {
    let timezone = null;

    // 1. Try reading from page localStorage (EncryptStorage with prefix @calibercard-frontend)
    try {
      timezone = await this.page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.includes('range')) {
            const val = localStorage.getItem(key);
            if (val && val.includes('timezone')) {
              try {
                const parsed = JSON.parse(val);
                if (parsed.timezone) return parsed.timezone;
                if (parsed.address?.state?.timezone) return parsed.address.state.timezone;
              } catch (_) {}
            }
          }
        }
        return null;
      });
    } catch (_) {}

    // 2. Query customer range API directly if not resolved from localStorage
    if (!timezone && rangeSlug) {
      try {
        const response = await this.page.request.get(
          `https://caliberadmin.yatilabs.com/api/v1/customer/range/${rangeSlug}`,
          { headers: { 'x-portal': 'CUSTOMER' } }
        );
        if (response.ok()) {
          const json = await response.json();
          timezone = json.data?.timezone || json.data?.address?.state?.timezone || null;
        }
      } catch (e) {
        console.log(`[BookingPage] Failed to fetch range details via API: ${e.message}`);
      }
    }

    if (!timezone) {
      throw new Error(`[BookingPage] Could not reliably identify timezone for Range slug "${rangeSlug}".`);
    }

    return timezone;
  }

  /**
   * Dynamically calculates target slot time based on Range-local time and selects an available slot.
   *
   * @param {string} rangeSlug - Slug of the current range
   * @param {Object} [options={}]
   * @param {boolean} [options.withinWindow=false] - If true, selects a slot within 2 hours of current range time (so check-in opens immediately). If false, selects >= 2 hours.
   * @returns {Promise<{
   *   timezone: string,
   *   currentRangeTime: string,
   *   targetRangeTime: string,
   *   selectedDateStr: string,
   *   selectedSlotTime: string
   * }>}
   */
  async selectSlotDynamicByTimezone(rangeSlug, options = {}) {
    const withinWindow = typeof options === 'boolean' ? options : (options?.withinWindow || false);
    await this.dismissGoogleMapsDialog();
    await this.ensureGuestTabActive();

    // 1. Get Range Timezone
    const timezone = await this.getRangeTimezone(rangeSlug);

    // 2. Calculate Range Current & Target (+2 hours) Time
    const { current, target } = calculateTargetSlotTime(timezone, 2);

    console.log(`\n========================================`);
    console.log(`[Timezone Calculation] Range Timezone Identifier: ${timezone}`);
    console.log(`[Timezone Calculation] Current Range Local Time:   ${current.formatted} (${current.timeZone})`);
    console.log(`[Timezone Calculation] Target Window (+2h):        ${target.formatted}`);
    console.log(`[Timezone Calculation] Selection Mode:             ${withinWindow ? 'WITHIN 2 HOURS (Check-In Eligible Now)' : 'AFTER 2 HOURS'}`);
    console.log(`========================================\n`);

    const dayChips = this.page.locator('.cc-daychip:not(.icon)');
    await expect(dayChips.first(), 'Expected date chips to be displayed').toBeVisible({ timeout: 10000 });
    const dayChipsCount = await dayChips.count();

    let selectedSlotText = null;
    let selectedDateStr = target.dateStr;

    // Check if target is today vs future date (e.g. crossing midnight)
    const isTargetToday = target.dateStr === current.dateStr;

    // Loop through available day chips to find the date and valid slot
    for (let i = 0; i < dayChipsCount; i++) {
      const chip = dayChips.nth(i);
      const isChipDisabled = (await chip.getAttribute('class'))?.includes('disabled');
      if (isChipDisabled) continue;

      // Click chip
      await chip.click({ force: true });
      await this.page.waitForTimeout(1000);
      await this.dismissGoogleMapsDialog();

      // Check slot loader has completed
      await this.page.locator('.cc-slots-loader').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

      // Locate all rendered slots on this day
      const slotLocators = this.page.locator('.cc-slot');
      const slotCount = await slotLocators.count();

      if (slotCount === 0) continue;

      // Extract slot texts and availability
      const slots = [];
      for (let s = 0; s < slotCount; s++) {
        const slotEl = slotLocators.nth(s);
        const text = (await slotEl.innerText()).trim();
        const className = (await slotEl.getAttribute('class')) || '';
        const isAvailable = !className.includes('disabled');
        const parsed = parseSlotTime(text);
        if (parsed) {
          slots.push({
            index: s,
            text,
            isAvailable,
            totalMinutes: parsed.totalMinutes,
            locator: slotEl,
          });
        }
      }

      const currentMinutes = current.hour * 60 + current.minute;
      const targetMinutes = target.hour * 60 + target.minute;

      if (withinWindow) {
        // Mode: Select slot within 2 hours of current range time (check-in is immediately open)
        // For today (i === 0), look for an available slot between currentMinutes and targetMinutes (currentMinutes + 120)
        let validSlots = [];
        if (i === 0) {
          validSlots = slots.filter((slot) => slot.isAvailable && slot.totalMinutes >= currentMinutes && slot.totalMinutes <= targetMinutes);
        }

        // If no slot strictly in [now, now+2h] on today, try any available slot on today within reasonable upcoming time or next available
        if (validSlots.length === 0 && i === 0) {
          validSlots = slots.filter((slot) => slot.isAvailable && slot.totalMinutes >= currentMinutes);
        }

        if (validSlots.length > 0) {
          const chosenSlot = validSlots[0];
          await chosenSlot.locator.click();
          await this.page.waitForTimeout(500);
          selectedSlotText = chosenSlot.text;
          selectedDateStr = current.dateStr;
          console.log(`[BookingPage] Selected slot within 2-hour window: "${selectedSlotText}" on ${selectedDateStr}`);
          break;
        } else {
          console.log(`[BookingPage] No slot within window on today. Checking next chip...`);
          continue;
        }
      } else {
        // Mode: Filter slots >= target time (+2 hours or future dates)
        if (i === 0 && isTargetToday) {
          const validSlots = slots.filter((slot) => slot.isAvailable && slot.totalMinutes >= targetMinutes);

          if (validSlots.length > 0) {
            const chosenSlot = validSlots[0];
            await chosenSlot.locator.click();
            await this.page.waitForTimeout(500);
            selectedSlotText = chosenSlot.text;
            selectedDateStr = target.dateStr;
            break;
          } else {
            console.log(`[BookingPage] No available slots >= ${target.timeStr} on current date (${current.dateStr}). Checking next available date chip.`);
            continue;
          }
        } else {
          // Future date: any available slot satisfies >= target time requirement
          const validSlots = slots.filter((slot) => slot.isAvailable);
          if (validSlots.length > 0) {
            const chosenSlot = validSlots[0];
            await chosenSlot.locator.click();
            await this.page.waitForTimeout(500);
            selectedSlotText = chosenSlot.text;
            const dnum = await chip.locator('.dnum').innerText().catch(() => '');
            selectedDateStr = dnum ? `${target.year}-${String(target.month).padStart(2, '0')}-${dnum.padStart(2, '0')}` : target.dateStr;
            break;
          }
        }
      }
    }

    if (!selectedSlotText) {
      throw new Error(`[BookingPage] Could not find any valid available slot (withinWindow=${withinWindow}) across available date chips.`);
    }

    return {
      timezone,
      currentRangeTime: current.formatted,
      targetRangeTime: target.formatted,
      selectedDateStr,
      selectedSlotTime: selectedSlotText,
    };
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
