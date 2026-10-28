import { loadConfig } from '../../src/config/env.js';

const base = {
  NODE_ENV: 'development',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/mazdoorpay',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
  QR_SECRET: 'y'.repeat(40),
};

describe('demo account passwords', () => {
  it('are optional, and come only from the environment', () => {
    const config = loadConfig(base);
    expect(config.demoPassword).toBeUndefined();
    expect(config.demoAdminPassword).toBeUndefined();
    const set = loadConfig({
      ...base,
      DEMO_PASSWORD: 'Site-visit-2026',
      DEMO_ADMIN_PASSWORD: 'Ops-check-2026',
    });
    expect(set).toMatchObject({
      demoPassword: 'Site-visit-2026',
      demoAdminPassword: 'Ops-check-2026',
    });
  });

  it('left empty, as in .env.example, they count as not set', () => {
    const config = loadConfig({ ...base, DEMO_PASSWORD: '', DEMO_ADMIN_PASSWORD: '' });
    expect(config.demoPassword).toBeUndefined();
    expect(config.demoAdminPassword).toBeUndefined();
  });

  it('must follow the password rules', () => {
    expect(() => loadConfig({ ...base, DEMO_PASSWORD: 'password' })).toThrow(/DEMO_PASSWORD/);
    expect(() => loadConfig({ ...base, DEMO_ADMIN_PASSWORD: 'abc1' })).toThrow(
      /DEMO_ADMIN_PASSWORD/
    );
  });

  it('must be at least 12 characters in production', () => {
    const prod = { ...base, NODE_ENV: 'production' };
    expect(() => loadConfig({ ...prod, DEMO_PASSWORD: 'Short-2026' })).toThrow(
      /DEMO_PASSWORD must be at least 12 characters/
    );
    expect(loadConfig({ ...prod, DEMO_PASSWORD: 'Long-enough-2026' }).demoPassword).toBe(
      'Long-enough-2026'
    );
  });
});
