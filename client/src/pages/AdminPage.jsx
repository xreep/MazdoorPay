import { useT } from '../lib/i18n.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { OverviewTab } from '../features/admin/OverviewTab.jsx';
import { UsersTab } from '../features/admin/UsersTab.jsx';
import { ActivityTab } from '../features/admin/ActivityTab.jsx';
import { AccuracyTab } from '../features/admin/AccuracyTab.jsx';
import { AnalyticsTab } from '../features/admin/AnalyticsTab.jsx';

const SECTIONS = {
  overview: { title: 'nav.overview', subtitle: 'admin.overviewSubtitle', Component: OverviewTab },
  users: { title: 'nav.users', subtitle: 'admin.usersSubtitle', Component: UsersTab },
  activity: { title: 'nav.activity', subtitle: 'admin.activitySubtitle', Component: ActivityTab },
  accuracy: { title: 'nav.accuracy', subtitle: 'admin.accuracySubtitle', Component: AccuracyTab },
  analytics: {
    title: 'nav.analytics',
    subtitle: 'admin.analyticsSubtitle',
    Component: AnalyticsTab,
  },
};

export default function AdminPage({ section }) {
  const t = useT();
  const { title, subtitle, Component } = SECTIONS[section];
  return (
    <>
      <PageHeader title={t(title)} subtitle={t(subtitle)} />
      <Component />
    </>
  );
}
