const fs = require('fs');
const path = require('path');

/**
 * The site is a JS app and its real DOM is not known up front, so every UI element is described
 * by a LIST of candidate locators. The first candidate that is visible wins.
 * When the real selector is known, put it FIRST in the list and it will be used first.
 *
 * candidates: array of  (page) => Locator   or a ready Locator
 */
async function pick(page, candidates, { label = 'element', timeout = 15000 } = {}) {
  const locators = candidates.map((c) => (typeof c === 'function' ? c(page) : c));
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const loc of locators) {
      try {
        const first = loc.first();
        if (await first.isVisible()) return first;
      } catch (_) {
        /* page navigating, try again */
      }
    }
    await page.waitForTimeout(300);
  }
  throw new Error(
    `[smart-locator] Could not find "${label}" after ${timeout} ms (tried ${locators.length} locators).\n` +
      `Fix: run "npm run codegen", copy the real selector and put it FIRST in that candidate list.`,
  );
}

/** Same as pick but returns null instead of throwing. */
async function tryPick(page, candidates, { label = 'element', timeout = 3000 } = {}) {
  try {
    return await pick(page, candidates, { label, timeout });
  } catch (_) {
    return null;
  }
}

/** Saves a numbered screenshot in /screenshots so you can review each step. */
async function snap(page, name) {
  try {
    fs.mkdirSync('screenshots', { recursive: true });
    const file = path.join('screenshots', `${Date.now()}-${name.replace(/[^a-z0-9-_]/gi, '_')}.png`);
    await page.screenshot({ path: file, fullPage: true });
  } catch (_) {
    /* never fail a test because of a screenshot */
  }
}

module.exports = { pick, tryPick, snap };
