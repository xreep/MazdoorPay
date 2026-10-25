// Money is always integer paise (₹1 = 100 paise) in storage and on the wire.

export const rupeesToPaise = (rupees) => {
  const n = typeof rupees === 'string' ? Number(rupees.trim()) : rupees;
  if (
    typeof n !== 'number' ||
    !Number.isFinite(n) ||
    n < 0 ||
    (typeof rupees === 'string' && rupees.trim() === '')
  ) {
    throw new TypeError(`Not a valid rupee amount: ${rupees}`);
  }
  return Math.round(Number((n * 100).toFixed(4)));
};

export const paiseToRupees = (paise) => paise / 100;

export const formatINR = (paise) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: paise % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(paise / 100);

export const earnedFor = (status, ratePaise) => {
  if (status === 'present') return ratePaise;
  if (status === 'half-day') return Math.floor(ratePaise / 2);
  return 0;
};
