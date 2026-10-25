const { BasePage } = require('./BasePage');

const NEXT = [(p) => p.getByRole('button', { name: /^(continue|next|proceed|confirm)\b/i })];
const ADD_TO_CART = [
  (p) => p.getByRole('button', { name: /add to cart/i }),
  (p) => p.getByRole('button', { name: /book( now)?|buy|reserve|checkout/i }),
];

/** Experience: experience -> ticket -> quantity -> add to cart */
class ExperiencePage extends BasePage {
  async selectExperience(name) {
    const candidates = name
      ? [(p) => p.getByRole('button', { name: new RegExp(name, 'i') }), (p) => p.getByText(new RegExp(name, 'i'))]
      : [
          (p) => p.locator('[class*="experience" i][class*="card" i]'),
          (p) => p.locator('[class*="experience" i] button'),
          (p) => p.getByRole('button', { name: /select|view|book|details|choose/i }),
          (p) => p.locator('[class*="card" i]'),
        ];
    await this.click(candidates, name ? `experience "${name}"` : 'first experience');
    await this.shot('experience-selected');
  }

  async selectTicket(name) {
    const candidates = name
      ? [
          (p) => p.locator('[class*="ticket" i]').filter({ hasText: new RegExp(name, 'i') }),
          (p) => p.getByText(new RegExp(name, 'i')),
        ]
      : [
          (p) => p.locator('[class*="ticket" i]'),
          (p) => p.getByRole('button', { name: /select|choose|add/i }),
        ];
    await this.click(candidates, name ? `ticket "${name}"` : 'first ticket');
    await this.shot('experience-ticket-selected');
  }

  /** Works for a number input and for a +/- stepper. */
  async setQuantity(qty) {
    const input = this.page.locator('input[type="number"], input[name*="qty" i], input[name*="quantity" i]').first();
    if (await input.isVisible().catch(() => false)) {
      await input.fill(String(qty));
      await this.shot('experience-quantity');
      return;
    }
    const plus = this.page.getByRole('button', { name: /^\+$|increase|plus|add one/i }).first();
    if (await plus.isVisible().catch(() => false)) {
      for (let i = 1; i < qty; i++) await plus.click();
      await this.shot('experience-quantity');
      return;
    }
    console.log('[skip] no quantity control found - using default quantity');
  }

  async addToCart() {
    await this.clickIfPresent(NEXT, 'next before add to cart', 2000);
    await this.click(ADD_TO_CART, 'add to cart');
    await this.shot('experience-added-to-cart');
  }
}

module.exports = { ExperiencePage };
