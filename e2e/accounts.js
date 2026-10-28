// Logins the end-to-end tests use. The demo accounts come from the seed; the operations admin is
// a real (non-demo) admin the test API creates, because the demo admin only sees demo accounts.
export const DEMO = {
  contractor: { email: 'ravi.kumar@mazdoorpay.in', password: 'E2e-Demo-2026' },
  admin: { email: 'admin@mazdoorpay.in', password: 'E2e-DemoAdmin-2026' },
};
export const OPS_ADMIN = { email: 'ops.admin@e2e.mazdoorpay.test', password: 'E2e-Admin-2026' };
