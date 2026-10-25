import { useState } from 'react';
import { dateRangeSchema } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { useActivity, useAdminUsers } from './useAdmin.js';

export const ACTIONS = [
  'auth.register',
  'auth.login',
  'user.update',
  'site.create',
  'site.update',
  'site.delete',
  'worker.create',
  'worker.update',
  'worker.rate',
  'worker.deactivate',
  'worker.reactivate',
  'attendance.create',
  'attendance.update',
  'payment.create',
  'payment.void',
  'admin.suspend',
  'admin.reactivate',
];

const whenIST = (iso) =>
  new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

export function ActivityTab() {
  const t = useT();
  const [filters, setFilters] = useState({ contractorId: '', action: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const { data: contractors } = useAdminUsers({ role: 'contractor', limit: 100 });
  const rangeOk =
    !filters.from ||
    !filters.to ||
    dateRangeSchema.safeParse({ from: filters.from, to: filters.to }).success;
  const { data, isPending, isError, error, refetch } = useActivity({
    ...filters,
    ...(rangeOk ? {} : { from: '', to: '' }),
    page,
  });
  const set = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };
  const actionLabel = (a) => t(`actions.${a.replace('.', '_')}`);

  return (
    <>
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('admin.contractor')}>
          <Select
            placeholder={t('admin.allContractors')}
            options={(contractors?.data ?? []).map((u) => ({ value: u._id, label: u.name }))}
            value={filters.contractorId}
            onChange={set('contractorId')}
          />
        </Field>
        <Field label={t('admin.action')}>
          <Select
            placeholder={t('admin.allActions')}
            options={ACTIONS.map((a) => ({ value: a, label: actionLabel(a) }))}
            value={filters.action}
            onChange={set('action')}
          />
        </Field>
        <Field label={t('attendance.from')}>
          <Input type="date" value={filters.from} onChange={set('from')} />
        </Field>
        <Field label={t('attendance.to')} error={rangeOk ? undefined : t('admin.badRange')}>
          <Input type="date" value={filters.to} onChange={set('to')} />
        </Field>
      </Card>
      {isPending && <SkeletonRows n={8} className="h-14" />}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {data && (
        <Card className="overflow-hidden">
          {data.data.length === 0 && (
            <p className="p-8 text-center text-ink-muted">{t('admin.noActivity')}</p>
          )}
          <ol aria-label={t('admin.activityLog')} className="divide-y divide-border">
            {data.data.map((e) => (
              <li
                key={e._id}
                className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4 sm:px-5"
              >
                <time dateTime={e.at} className="num text-sm text-ink-muted">
                  {whenIST(e.at)}
                </time>
                <div className="min-w-0">
                  <p>
                    <span className="font-semibold">
                      {e.actor?.name ?? t('admin.unknownActor')}
                    </span>{' '}
                    <span className="text-ink-muted">·</span> <span>{actionLabel(e.action)}</span>
                  </p>
                  {e.after?.voidReason && (
                    <p className="truncate text-sm text-ink-muted">{e.after.voidReason}</p>
                  )}
                  {e.after?.reason && (
                    <p className="truncate text-sm text-ink-muted">{e.after.reason}</p>
                  )}
                  {e.after?.suspendedReason && (
                    <p className="truncate text-sm text-ink-muted">{e.after.suspendedReason}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPage} />}
    </>
  );
}
