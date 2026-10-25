import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { LinkIcon } from 'lucide-react';
import { formatINR } from '@mazdoorpay/shared';
import { api } from '../lib/api.js';
import { useFormat, useT } from '../lib/i18n.jsx';
import { Logo } from '../components/layout/Logo.jsx';
import { WorkerLanguage } from '../components/layout/PrintLayout.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';
import { SkeletonRows } from '../components/ui/Skeleton.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);

// Public: what a worker sees when they open the link their contractor sent them.
export default function StatementPage() {
  const t = useT();
  const { token } = useParams();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['statement', token],
    queryFn: () => api.get(`/statements/${encodeURIComponent(token)}`),
    retry: (count, err) => err.status !== 404 && count < 2,
  });

  // Private pages stay out of search engines.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.append(meta);
    return () => meta.remove();
  }, []);

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-6">
          <Logo />
        </div>
        {isPending ? (
          <SkeletonRows n={5} />
        ) : isError ? (
          error.status === 404 ? (
            <EmptyState
              icon={LinkIcon}
              title={t('statement.invalidTitle')}
              body={t('statement.invalidBody')}
            />
          ) : (
            <QueryError error={error} onRetry={refetch} />
          )
        ) : (
          <WorkerLanguage worker={data.worker}>
            <Statement data={data} />
          </WorkerLanguage>
        )}
      </div>
    </div>
  );
}

function Statement({ data }) {
  const t = useT();
  const { formatDay } = useFormat();
  const { worker, contractor, balance, days, payments } = data;
  const owed = balance.balance;
  const heading =
    owed > 0 ? t('statement.owed') : owed < 0 ? t('statement.advance') : t('statement.settled');
  const counted = payments.filter((p) => !p.voided);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{worker.name}</h1>
        <p className="text-ink-muted">
          {t(`roles.${worker.role}`)} · {t('statement.from', { name: contractor.name })}
        </p>
      </div>

      <section
        aria-label={heading}
        className={`rounded-card p-5 ${owed > 0 ? 'bg-ink text-white' : 'bg-brand-soft text-ink'}`}
      >
        <p className={`text-sm font-medium ${owed > 0 ? 'text-white/70' : 'text-brand-ink'}`}>
          {heading}
        </p>
        <p className="num mt-1 text-4xl font-bold">{formatINR(Math.abs(owed))}</p>
        <p className={`mt-2 text-sm ${owed > 0 ? 'text-white/70' : 'text-ink-muted'}`}>
          {t('statement.balanceNote')}
        </p>
      </section>

      <section className="rounded-card bg-surface p-5 shadow-card">
        <h2 className="font-bold">{t('statement.last90')}</h2>
        <p className="num mt-1 text-ink-muted">
          {t('statement.daysSummary', {
            present: days.filter((d) => d.status === 'present').length,
            halfDay: days.filter((d) => d.status === 'half-day').length,
          })}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-control bg-surface-2 p-3">
            <dt className="text-sm text-ink-muted">{t('statement.earned')}</dt>
            <dd className="num text-lg font-semibold">{formatINR(sum(days, (d) => d.earned))}</dd>
          </div>
          <div className="rounded-control bg-surface-2 p-3">
            <dt className="text-sm text-ink-muted">{t('statement.paid')}</dt>
            <dd className="num text-lg font-semibold">
              {formatINR(sum(counted, (p) => p.amount))}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-card bg-surface p-5 shadow-card">
        <h2 className="mb-2 font-bold">{t('statement.payments')}</h2>
        {payments.length === 0 ? (
          <p className="text-ink-muted">{t('statement.noPayments')}</p>
        ) : (
          <ul aria-label={t('statement.payments')} className="divide-y divide-border">
            {payments.map((p, i) => (
              <li key={`${p.day}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className={p.voided ? 'text-ink-muted line-through' : ''}>
                  <p className="font-medium">
                    {t(`payments.type.${p.type}`)} · {t(`payments.method.${p.method}`)}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {formatDay(p.day)}
                    {p.reference ? ` · ${p.reference}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {p.voided && (
                    <span className="rounded-full bg-absent-soft px-2 py-0.5 text-xs font-semibold text-absent">
                      {t('payments.void')}
                    </span>
                  )}
                  <span className="num font-semibold">{formatINR(p.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card bg-surface p-5 shadow-card">
        <h2 className="mb-2 font-bold">{t('statement.attendance')}</h2>
        {days.length === 0 ? (
          <p className="text-ink-muted">{t('statement.noDays')}</p>
        ) : (
          <ul aria-label={t('statement.attendance')} className="divide-y divide-border">
            {days.map((d) => (
              <li key={d.day} className="flex items-center justify-between gap-3 py-2">
                <span>{formatDay(d.day)}</span>
                <span className="flex items-center gap-3">
                  <StatusBadge status={d.status} />
                  <span className="num w-20 text-right">{formatINR(d.earned)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="pb-6 text-center text-sm text-ink-muted">{t('statement.footer')}</p>
    </div>
  );
}
