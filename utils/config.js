require('dotenv').config();

const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);
const bool = (v, d = false) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');

module.exports = {
  CUSTOMER_URL: (process.env.CUSTOMER_URL || 'https://calibercard.yatilabs.com').replace(/\/$/, ''),
  ADMIN_URL: process.env.ADMIN_URL || 'https://calibercard-range.yatilabs.com/home',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'rangeadminuser01@yopmail.com',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Test@12345',
  ADMIN_AUTH_FILE: '.auth/range-admin.json',

  AUTH_FILE: '.auth/user.json',
  USER_FILE: 'test-data/runtime-user.json',

  OTP_PROVIDER: (process.env.OTP_PROVIDER || 'mailinator').toLowerCase(),
  EMAIL_PREFIX: process.env.EMAIL_PREFIX || 'caliberqa',
  GMAIL_USER: process.env.GMAIL_USER || '',
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',
  TEST_EMAIL: process.env.TEST_EMAIL || '',
  FRESH_USER: bool(process.env.FRESH_USER, true),

  SLOW_MO: num(process.env.SLOW_MO, 0),

  RANGE_NAME: process.env.RANGE_NAME || '',
  SLOT_TIME: process.env.SLOT_TIME || '',
  FIELD_COUNT: num(process.env.FIELD_COUNT, 1),
  PARTICIPANT_COUNT: num(process.env.PARTICIPANT_COUNT, 2),

  EXPERIENCE_NAME: process.env.EXPERIENCE_NAME || '',
  TICKET_NAME: process.env.TICKET_NAME || '',
  TICKET_QTY: num(process.env.TICKET_QTY, 2),

  SKIP_PAYMENT: bool(process.env.SKIP_PAYMENT, false),
  CARD: {
    number: process.env.CARD_NUMBER || '4242424242424242',
    exp: process.env.CARD_EXP || '12/34',
    cvc: process.env.CARD_CVC || '123',
    zip: process.env.CARD_ZIP || '12345',
  },
};
