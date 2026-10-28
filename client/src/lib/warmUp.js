import { duesQuery } from '../features/payments/usePayments.js';
import { DEFAULT_WORKER_FILTERS, workersQuery } from '../features/workers/useWorkers.js';
import { wageSummaryQuery } from '../features/wages/useWageSummary.js';
import { sitesQuery } from '../features/sites/useSites.js';
import { periodRange } from '../features/wages/PeriodPicker.jsx';

// The main pages' code, fetched ahead so opening them never waits for a download.
const CONTRACTOR_PAGES = [
  () => import('../pages/AttendancePage.jsx'),
  () => import('../pages/WorkersPage.jsx'),
  () => import('../pages/PaymentsPage.jsx'),
  () => import('../pages/WagesPage.jsx'),
  () => import('../pages/SitesPage.jsx'),
];

// The data each main page asks for when it opens, under the same keys the pages use.
export const contractorStartQueries = () => [
  duesQuery(),
  workersQuery(DEFAULT_WORKER_FILTERS),
  wageSummaryQuery({ ...periodRange('this-week'), groupBy: 'week', siteId: '' }),
  sitesQuery('all'),
  sitesQuery('active'),
];

// After sign-in, while the phone is idle: load the main pages' code and data in the background,
// so the first visit to each shows content instead of a loading skeleton.
export function warmUpContractorPages(queryClient) {
  const whenIdle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
  whenIdle(() => {
    for (const load of CONTRACTOR_PAGES) load().catch(() => {});
    for (const query of contractorStartQueries()) queryClient.prefetchQuery(query);
  });
}
