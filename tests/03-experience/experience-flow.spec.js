const { test } = require('../../fixtures/test-fixtures');
const cfg = require('../../utils/config');

test('Experience: experience -> ticket -> quantity -> cart -> pay', async ({ dashboard, experience, cart }) => {
  await test.step('dashboard: open Experience', async () => {
    await dashboard.openHome();
    await dashboard.openExperience();
  });

  await test.step('select experience', () => experience.selectExperience(cfg.EXPERIENCE_NAME));
  await test.step('select ticket', () => experience.selectTicket(cfg.TICKET_NAME));
  await test.step('set quantity', () => experience.setQuantity(cfg.TICKET_QTY));
  await test.step('add to cart', () => experience.addToCart());

  await test.step('open cart and pay', async () => {
    await dashboard.openCart();
    await cart.checkoutAndPay();
  });
});
