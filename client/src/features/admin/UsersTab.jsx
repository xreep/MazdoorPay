import { useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';
import { formatDay, initials } from '../../lib/format.js';
import { useDebouncedValue } from '../../lib/hooks.js';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { useAdminUsers } from './useAdmin.js';
import { UserDrawer } from './UserDrawer.jsx';

const istDay = (iso) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 10);

export function UsersTab() {
  const t = useT();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const search = useDebouncedValue(q.trim(), 300);
  const { data, isPending, isError, error, refetch } = useAdminUsers({ q: search, status, page });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label={t('admin.searchUsers')}
            placeholder={t('admin.searchUsers')}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="pl-11"
          />
        </div>
        <SegmentedControl
          label={t('admin.statusFilter')}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: '', label: t('common.all') },
            { value: 'active', label: t('common.active') },
            { value: 'suspended', label: t('admin.statusSuspended') },
          ]}
        />
      </div>
      {isPending && <SkeletonRows n={5} className="h-16" />}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {data && (
        <Card className="divide-y divide-border overflow-hidden">
          {data.data.length === 0 && (
            <p className="p-8 text-center text-ink-muted">{t('admin.noUsers')}</p>
          )}
          {data.data.map((u) => {
            const titleId = `user-${u._id}`;
            return (
              <article
                key={u._id}
                aria-labelledby={titleId}
                className="flex items-center gap-4 px-4 py-3.5 sm:px-5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                  {initials(u.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span id={titleId} className="font-semibold">
                      {u.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.role === 'admin' ? 'bg-ink text-white' : 'bg-surface-2 text-ink-muted'}`}
                    >
                      {u.role === 'admin' ? t('nav.roleAdmin') : t('nav.roleContractor')}
                    </span>
                    {u.status === 'suspended' && (
                      <span className="rounded-full bg-absent-soft px-2 py-0.5 text-xs font-semibold text-absent">
                        {t('admin.statusSuspended')}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-ink-muted">
                    {u.email}
                    {u.role === 'contractor' &&
                      ` · ${t('admin.userCounts', { sites: u.sites, workers: u.workers })}`}
                    {u.lastLoginAt &&
                      ` · ${t('admin.lastLogin', { day: formatDay(istDay(u.lastLoginAt)) })}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(u._id)}
                  aria-label={t('admin.viewUser', { name: u.name })}
                  className="flex h-12 w-12 items-center justify-center rounded-control hover:bg-ink/5"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </article>
            );
          })}
        </Card>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
      {open && <UserDrawer userId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
