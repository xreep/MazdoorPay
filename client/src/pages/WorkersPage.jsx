import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, Plus, Search, Users } from 'lucide-react';
import { WORKER_ROLES } from '@mazdoorpay/shared';
import { useT } from '../lib/i18n.jsx';
import { initials } from '../lib/format.js';
import { useDebouncedValue } from '../lib/hooks.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Money } from '../components/ui/Money.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';
import { SegmentedControl } from '../components/ui/SegmentedControl.jsx';
import { Select } from '../components/ui/Select.jsx';
import { SkeletonRows } from '../components/ui/Skeleton.jsx';
import { useSites } from '../features/sites/useSites.js';
import { useWorkers } from '../features/workers/useWorkers.js';
import { WorkerForm } from '../features/workers/WorkerForm.jsx';

function WorkerRow({ worker, siteName }) {
  const t = useT();
  return (
    <li>
      <Link
        to={`/workers/${worker._id}`}
        className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-surface-2 sm:px-5"
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${worker.isActive ? 'bg-ink text-on-ink' : 'bg-surface-2 text-ink-muted'}`}
        >
          {initials(worker.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{worker.name}</span>
          <span className="mt-0.5 flex flex-wrap gap-x-2 text-sm text-ink-muted">
            <span>{t(`roles.${worker.role}`)}</span>
            <span aria-hidden="true">•</span>
            <span className="truncate">{siteName ?? t('workers.noSite')}</span>
          </span>
        </span>
        <span className="text-right">
          <Money paise={worker.dailyRate} className="block font-semibold" />
          <span className="text-xs text-ink-muted">{t('workers.perDay')}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default function WorkersPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [siteId, setSiteId] = useState(params.get('siteId') ?? '');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('active');
  const [pageNo, setPageNo] = useState(1);
  const search = useDebouncedValue(q.trim(), 300);
  const { data: sites } = useSites('all');
  const siteNames = useMemo(() => new Map((sites ?? []).map((s) => [s._id, s.name])), [sites]);
  const filters = { q: search, siteId, role, status, page: pageNo };
  const { data, isPending, isError, error, refetch, isFetching } = useWorkers(filters);
  const formOpen = params.get('new') === '1';
  const filtered = Boolean(search || siteId || role || status !== 'active');

  const setFilter = (setter) => (value) => {
    setter(value);
    setPageNo(1);
  };
  const openNew = () =>
    setParams((p) => ({ ...Object.fromEntries(p), new: '1' }), { replace: true });
  const closeNew = () =>
    setParams(
      (p) => {
        const next = Object.fromEntries(p);
        delete next.new;
        return next;
      },
      { replace: true }
    );

  return (
    <>
      <PageHeader
        title={t('workers.title')}
        subtitle={data ? t('workers.count', { n: data.total }) : ' '}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            {t('workers.addTitle')}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem_11rem]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label={t('workers.search')}
            placeholder={t('workers.searchShort')}
            value={q}
            onChange={(e) => setFilter(setQ)(e.target.value)}
            className="pl-11"
          />
        </div>
        <Field label={t('workers.site')} className="[&>label]:sr-only">
          <Select
            placeholder={t('workers.allSites')}
            options={(sites ?? []).map((s) => ({ value: s._id, label: s.name }))}
            value={siteId}
            onChange={(e) => setFilter(setSiteId)(e.target.value)}
          />
        </Field>
        <Field label={t('workers.role')} className="[&>label]:sr-only">
          <Select
            placeholder={t('workers.allRoles')}
            options={WORKER_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            value={role}
            onChange={(e) => setFilter(setRole)(e.target.value)}
          />
        </Field>
      </div>
      <SegmentedControl
        label={t('workers.statusFilter')}
        className="mb-4"
        value={status}
        onChange={setFilter(setStatus)}
        options={[
          { value: 'active', label: t('common.active') },
          { value: 'inactive', label: t('common.inactive') },
          { value: 'all', label: t('common.all') },
        ]}
      />

      {isPending && <SkeletonRows n={6} className="h-16" />}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {data && data.data.length === 0 && (
        <Card>
          <EmptyState
            icon={Users}
            title={filtered ? t('workers.noMatchTitle') : t('workers.emptyTitle')}
            body={filtered ? t('workers.noMatchBody') : t('workers.emptyBody')}
            action={
              !filtered && (
                <Button onClick={openNew}>
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  {t('workers.addFirst')}
                </Button>
              )
            }
          />
        </Card>
      )}
      {data && data.data.length > 0 && (
        <Card className={`overflow-hidden transition-opacity ${isFetching ? 'opacity-70' : ''}`}>
          <ul className="divide-y divide-border">
            {data.data.map((w) => (
              <WorkerRow
                key={w._id}
                worker={w}
                siteName={w.siteId ? siteNames.get(w.siteId) : null}
              />
            ))}
          </ul>
        </Card>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPageNo} />}

      <WorkerForm open={formOpen} defaultSiteId={siteId || null} onClose={closeNew} />
    </>
  );
}
