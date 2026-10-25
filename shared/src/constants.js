export const WORKER_ROLES = [
  'mason',
  'labourer',
  'electrician',
  'plumber',
  'carpenter',
  'painter',
  'welder',
  'helper',
  'other',
];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'half-day'];
export const PAYMENT_TYPES = ['wage', 'advance'];
export const PAYMENT_METHODS = ['cash', 'upi', 'bank'];
export const LANGUAGES = ['en', 'hi'];
export const USER_ROLES = ['contractor', 'admin'];
export const USER_STATUSES = ['active', 'suspended'];

export const LIMITS = Object.freeze({
  RATE_MIN_PAISE: 5000,
  RATE_MAX_PAISE: 1000000,
  PAYMENT_MAX_PAISE: 50000000,
  PAGE_DEFAULT: 20,
  PAGE_MAX: 100,
  BACKDATE_REASON_DAYS: 7,
  MAX_RANGE_DAYS: 366,
});

export const PATTERNS = Object.freeze({
  PHONE_IN: /^[6-9]\d{9}$/,
  UPI_ID: /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64}$/,
  UTR: /^\d{12}$/,
  DAY: /^\d{4}-\d{2}-\d{2}$/,
  MONTH: /^\d{4}-\d{2}$/,
});
