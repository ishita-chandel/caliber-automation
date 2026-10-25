const { pick, tryPick, snap } = require('../../utils/smart-locator');

class BasePage {
  constructor(page) {
    this.page = page;
  }

  async goto(url = '/') {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    await this.waitReady();
  }

  /** SPA: let network settle, but never block the test if the app keeps polling. */
  async waitReady(timeout = 5000) {
    await this.page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  }

  async click(candidates, label, timeout) {
    const el = await pick(this.page, candidates, { label, timeout });
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click();
    await this.waitReady();
    return el;
  }

  /** Clicks only if the element exists (optional steps like "Continue"). Returns true/false. */
  async clickIfPresent(candidates, label, timeout = 3000) {
    const el = await tryPick(this.page, candidates, { label, timeout });
    if (!el) {
      console.log(`[skip] "${label}" not present`);
      return false;
    }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.click();
    await this.waitReady();
    return true;
  }

  async fill(candidates, value, label, timeout) {
    const el = await pick(this.page, candidates, { label, timeout });
    await el.fill(value);
    return el;
  }

  async fillIfPresent(candidates, value, label, timeout = 2000) {
    const el = await tryPick(this.page, candidates, { label, timeout });
    if (!el) return false;
    await el.fill(value);
    return true;
  }

  async shot(name) {
    await snap(this.page, name);
  }
}

module.exports = { BasePage };
