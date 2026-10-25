const fs = require('fs');
const path = require('path');
const cfg = require('./config');

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL / USER HELPERS  (shared with all modules)
// ═══════════════════════════════════════════════════════════════════════════

/** mailinator.com / yopmail.com / gmail.com -> which inbox reader to use */
function providerOf(email) {
  const domain = String(email).split('@')[1].toLowerCase();
  if (domain === 'yopmail.com') return 'yopmail';
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'gmail';
  return 'mailinator';
}

function pickProvider() {
  if (cfg.OTP_PROVIDER === 'random') return Math.random() < 0.5 ? 'mailinator' : 'yopmail';
  return cfg.OTP_PROVIDER;
}

/** A brand new, unique user for every run so signup never collides with an old account. */
function generateUser() {
  const provider = pickProvider();
  const stamp = `${Date.now()}`.slice(-8);
  let email;

  if (provider === 'yopmail') {
    email = `${cfg.EMAIL_PREFIX}${stamp}@yopmail.com`;
  } else if (provider === 'gmail') {
    if (!cfg.GMAIL_USER) throw new Error('OTP_PROVIDER=gmail needs GMAIL_USER in .env');
    const [local, domain] = cfg.GMAIL_USER.split('@');
    email = `${local}+${cfg.EMAIL_PREFIX}${stamp}@${domain}`; // plus-address lands in the same inbox
  } else {
    email = `${cfg.EMAIL_PREFIX}${stamp}@mailinator.com`;
  }

  return {
    firstName: 'QA',
    lastName: `Auto${stamp}`,
    email,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    provider: providerOf(email),
  };
}

function generateParticipants(count) {
  return Array.from({ length: count }, (_, i) => {
    const stamp = `${Date.now()}`.slice(-6);
    return {
      firstName: `Guest${i + 1}`,
      lastName: `Auto${stamp}`,
      email: `${cfg.EMAIL_PREFIX}guest${i + 1}${stamp}@mailinator.com`,
    };
  });
}

function saveUser(user) {
  fs.mkdirSync(path.dirname(cfg.USER_FILE), { recursive: true });
  fs.writeFileSync(cfg.USER_FILE, JSON.stringify(user, null, 2));
}

/** TEST_EMAIL in .env wins; otherwise use the user created by the signup test. */
function loadUser() {
  if (cfg.TEST_EMAIL) {
    return { firstName: 'QA', lastName: 'Existing', email: cfg.TEST_EMAIL, phone: '', provider: providerOf(cfg.TEST_EMAIL) };
  }
  if (!fs.existsSync(cfg.USER_FILE)) {
    throw new Error('No user found. Run signup first ("npm run signup") or set TEST_EMAIL in .env');
  }
  return JSON.parse(fs.readFileSync(cfg.USER_FILE, 'utf-8'));
}

function savedUserExists() {
  return fs.existsSync(cfg.USER_FILE);
}

// ═══════════════════════════════════════════════════════════════════════════
// DATE FORMATTING  (shared helper for admin date pickers)
// ═══════════════════════════════════════════════════════════════════════════

/** "MM/DD/YYYY hh:mm AM|PM" – the format the admin date pickers accept */
function formatDateTime(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const yyyy = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${mm}/${dd}/${yyyy} ${pad(hours)}:${pad(d.getMinutes())} ${ampm}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RANGE DATA  (used by Range Creation tests)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates structured test data for creating a range (General tab).
 * Allows passing custom overrides when needed.
 */
function generateRangeData(overrides = {}) {
  const stamp = `${Date.now()}`.slice(-6);
  return {
    name: `Test Range ${stamp}`,
    description: 'Premier indoor shooting facility featuring modern target lanes, gun rentals, and expert training.',
    subHeading: 'Precision & Tactical Shooting',
    phone: `555${Math.floor(1000000 + Math.random() * 8999999)}`,
    email: `testrange${stamp}@yopmail.com`,
    website: 'https://caliberrangetest.com',
    shotproPartner: true,
    nssfPartner: true,
    usccaPartner: false,
    firearm: true,
    archery: false,
    gunTypes: ['Handgun', 'Long Gun', 'Suppressed'],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPERIENCE DATA  (used by Experience / Class Creation tests)
// ═══════════════════════════════════════════════════════════════════════════

/** Default Experience field values – matches the application's General tab */
const EXPERIENCE_DEFAULTS = {
  name: 'Beginner Pistol Training',
  prerequisite: 'Must be 18+ and complete the range safety briefing.',
  shortDescription:
    'A beginner-friendly pistol training session covering firearm safety, handling, and basic shooting techniques.',
  longDescription:
    'This instructor-led experience introduces participants to firearm safety, range rules, proper grip, stance, aiming, and basic shooting techniques. All participants must follow the instructor\'s directions and range safety policies.',
  skillLevel: 'ENTRY',
  sessionDuration: '30 minutes',
  coins: '100',
  termsAndConditions:
    'Participants must follow all range safety rules and instructor instructions. Arrive 15 minutes before the session. Cancellations must comply with the range cancellation policy.',
  hideAfterExpiration: false,
  active: true,
  category: null,   // fill only if a known valid category exists in the test env
  instructor: null,
  imagePath: null,
  featured: false,
};

/**
 * Generates Experience test data with dynamic dates and a unique name suffix.
 * @param {object} overrides – fields to override from the defaults
 * @returns {object} ready-to-use Experience data object
 */
function generateExperienceData(overrides = {}) {
  const stamp = `${Date.now()}`.slice(-6);
  const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);  // +7 days
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);    // start + 8 hours
  const doorOpen = new Date(start.getTime() - 15 * 60 * 1000);   // start - 15 min

  return {
    ...EXPERIENCE_DEFAULTS,
    name: `Beginner Pistol Training ${stamp}`,
    startDateTime: formatDateTime(start),
    endDateTime: formatDateTime(end),
    doorOpenTime: formatDateTime(doorOpen),
    ...overrides,
  };
}

/**
 * Returns a completely fresh Experience data copy with a unique name.
 * Useful for tests that must avoid duplicate-name collisions.
 */
function createUniqueExperienceData(overrides = {}) {
  return generateExperienceData({
    name: `Experience ${Date.now()}`,
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT DATA  (used by Add Product popup inside Experience wizard)
// ═══════════════════════════════════════════════════════════════════════════

/** Default Product field values */
const PRODUCT_DEFAULTS = {
  name: 'Beginner Training Kit',
  regularPrice: '100.00',
  salePrice: '80.00',
  stock: '50',
  minOrderQty: '1',
  active: true,
  description:
    'Training kit for beginners, including essential range training accessories. Available while stock lasts.',
};

/**
 * Generates Product test data with dynamic selling dates.
 * @param {object} overrides – fields to override from the defaults
 * @returns {object} ready-to-use Product data object
 */
function generateProductData(overrides = {}) {
  const stamp = `${Date.now()}`.slice(-6);
  const sellingStart = new Date();
  const sellingEnd = new Date();
  sellingEnd.setMonth(sellingEnd.getMonth() + 1);

  return {
    ...PRODUCT_DEFAULTS,
    name: `Beginner Training Kit ${stamp}`,
    sellingStart,
    sellingEnd,
    ...overrides,
  };
}

/**
 * Returns a fresh Product data copy with a unique name.
 */
function createUniqueProductData(overrides = {}) {
  return generateProductData({
    name: `Product ${Date.now()}`,
    ...overrides,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTRUCTOR DATA  (used by Range Admin > Settings > Instructor)
// ═══════════════════════════════════════════════════════════════════════════

/** Default Instructor field values */
const INSTRUCTOR_DEFAULTS = {
  firstName: 'Aarav',
  lastName: 'Sharma',
  phone: '692-555-0147',
  password: 'Test@12345',
  dateOfBirth: '1995-05-15', // HTML5 date format YYYY-MM-DD
  gender: 'Male',
  zipCode: '10001',
  type: 'Rover',
  skillLevel: 'Beginner/In-training',
  bio: 'Certified firearms instructor with experience in firearm safety, range procedures, beginner training, and responsible handling. Focused on providing safe and structured training sessions for members.',
  avatar: null,
};

/**
 * Generates Instructor test data with a unique email and optional overrides.
 * @param {object} overrides – fields to override from the defaults
 * @returns {object} ready-to-use Instructor data object
 */
function generateInstructorData(overrides = {}) {
  const stamp = `${Date.now()}`.slice(-4);
  const randomPhoneDigits = Math.floor(1000000 + Math.random() * 9000000);
  return {
    ...INSTRUCTOR_DEFAULTS,
    lastName: `Sharma${stamp}`,
    phone: `692${randomPhoneDigits}`,
    email: `aarav.sharma.qa.${Date.now()}.${Math.floor(Math.random() * 1000)}@yopmail.com`,
    ...overrides,
  };
}

/**
 * Returns a fresh Instructor data copy with unique email.
 */
function createUniqueInstructorData(overrides = {}) {
  return generateInstructorData(overrides);
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLE
// ═══════════════════════════════════════════════════════════════════════════

function generateRoleData(overrides = {}) {
  const stamp = `${Date.now()}`.slice(-6);
  return {
    name: `Staff QA ${stamp}`,
    ...overrides,
  };
}

function createUniqueRoleData(overrides = {}) {
  return generateRoleData(overrides);
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRATION USER DATA (Consumer Membership Registration)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generates unique, realistic test user data for consumer membership registration.
 */
function generateRegistrationUser(overrides = {}) {
  const provider = pickProvider();
  const stamp = `${Date.now()}`.slice(-6);
  let email;

  if (provider === 'yopmail') {
    email = `${cfg.EMAIL_PREFIX}reg${stamp}@yopmail.com`;
  } else if (provider === 'gmail') {
    if (!cfg.GMAIL_USER) throw new Error('OTP_PROVIDER=gmail needs GMAIL_USER in .env');
    const [local, domain] = cfg.GMAIL_USER.split('@');
    email = `${local}+${cfg.EMAIL_PREFIX}reg${stamp}@${domain}`;
  } else {
    email = `${cfg.EMAIL_PREFIX}reg${stamp}@mailinator.com`;
  }

  const randomPhoneDigits = Math.floor(1000000 + Math.random() * 9000000);

  return {
    firstName: `Alex${stamp}`,
    lastName: `Taylor${stamp}`,
    email,
    phone: `692${randomPhoneDigits}`,
    gender: 'Male',
    dob: 'Oct 24, 2000',
    address: {
      search: '78 Main Street',
    },
    provider: providerOf(email),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // User / auth
  generateUser,
  generateRegistrationUser,
  generateParticipants,
  saveUser,
  loadUser,
  savedUserExists,
  providerOf,

  // Date formatting
  formatDateTime,

  // Range
  generateRangeData,

  // Experience
  generateExperienceData,
  createUniqueExperienceData,

  // Product
  generateProductData,
  createUniqueProductData,

  // Instructor
  generateInstructorData,
  createUniqueInstructorData,

  // Role
  generateRoleData,
  createUniqueRoleData,
};
