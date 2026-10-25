// Small API-shaped fixtures shared by page tests. Ids are real-looking ObjectIds because forms validate them.
export const S1 = '64b7f0c2a1b2c3d4e5f60001';
export const S2 = '64b7f0c2a1b2c3d4e5f60002';
export const W1 = '64b7f0c2a1b2c3d4e5f6a001';
export const sitesResponse = {
  sites: [
    {
      _id: S1,
      name: 'Prestige Lakeside – Whitefield',
      location: 'Bengaluru',
      isActive: true,
      activeWorkers: 2,
      totalWorkers: 2,
    },
    {
      _id: S2,
      name: 'Sobha Tower – Hebbal',
      location: 'Bengaluru',
      isActive: true,
      activeWorkers: 1,
      totalWorkers: 1,
    },
  ],
};

export const worker = (overrides = {}) => ({
  _id: 'w1',
  name: 'Ramesh Kumar',
  role: 'mason',
  dailyRate: 95000,
  siteId: S1,
  phone: '9876543210',
  upiId: 'ramesh@oksbi',
  preferredLanguage: 'hi',
  joinedOn: '2026-08-26',
  isActive: true,
  qrVersion: 1,
  rateHistory: [{ rate: 95000, effectiveFrom: '2026-08-26' }],
  ...overrides,
});

export const page = (data, extra = {}) => ({
  data,
  page: 1,
  limit: 20,
  total: data.length,
  pages: 1,
  ...extra,
});
