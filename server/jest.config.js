export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  globalSetup: '<rootDir>/tests/global-setup.js',
  globalTeardown: '<rootDir>/tests/global-teardown.js',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 30000,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js', '!src/seed/index.js', '!src/scripts/**'],
  coverageThreshold: { global: { lines: 80, branches: 70 } },
  coverageReporters: ['text-summary', 'lcov'],
};
