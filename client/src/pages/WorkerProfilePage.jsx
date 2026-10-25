import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { HandCoins, IndianRupee, Pencil, Phone, Power, UserX } from 'lucide-react';
import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../lib/i18n.jsx';
import { formatDay, initials } from '../lib/format.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Money } from '../components/ui/Money.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton.jsx';
import { WorkerForm } from '../features/workers/WorkerForm.jsx';
import { RateChangeDialog } from '../features/workers/RateChangeDialog.jsx';
import { WorkerCalendar } from '../features/workers/WorkerCalendar.jsx';
import { useSetWorkerActive, useWorkerSummary } from '../features/workers/useWorkers.js';

const linkButton =
  'inline-flex h-12 items-center justify-center gap-2 rounded-control px-5 font-semibold transition';

function BalanceCard({ balance }) {
  const t = useT();
  const owed = balance.balance >= 0;
  return (
    <section
      aria-label={t('workers.money')}
      className="grid overflow-hidden rounded-card bg-surface shadow-card sm:grid-cols-3"
    >
      <div className="p-5">
        <p className="text-sm font-medium text-ink-muted">{t('workers.earned')}</p>
        <p className="num mt-1 text-2xl font-bold">{formatINR(balance.earned)}</p>
      </div>
      <div className="border-t border-border p-5 sm:border-l sm:border-t-0">
        <p className="text-sm font-medium text-ink-muted">{t('workers.paid')}</p>
        <p className="num mt-1 text-2xl font-bold">{formatINR(balance.paid)}</p>
        {balance.paidAdvance > 0 && (
          <p className="num mt-0.5 text-sm text-ink-muted">
            {t('workers.includesAdvance', { amount: formatINR(balance.paidAdvance) })}
          </p>
        )}
      </div>
      <div className={`p-5 ${owed ? 'bg-ink text-white' : 'bg-brand-soft text-ink'}`}>
        <p className={`text-sm font-medium ${owed ? 'text-white/70' : 'text-brand-ink'}`}>
          {owed ? t('workers.balanceDue') : t('workers.advanceOutstanding')}
        </p>
        <p className="num mt-1 text-[1.75rem] font-bold leading-tight">
          {formatINR(Math.abs(balance.balance))}
        </p>
      </div>
    </section>
  );
}

function Detail({ label, children }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default function WorkerProfilePage() {
  const t = useT();
  const { id } = useParams();
  const { data, isPending, isError, error, refetch } = useWorkerSummary(id);
  const setActive = useSetWorkerActive();
  const [editOpen, setEditOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);

  if (isPending) {
    return (
      <div role="status" aria-label="Loading" className="space-y-6">
        <Skeleton className="h-16 w-72" />
        <Skeleton className="h-28" />
        <SkeletonRows n={4} />
      </div>
    );
  }
  if (isError) {
    if (error.status === 404)
      return (
        <EmptyState
          icon={UserX}
          title={t('workers.notFound')}
          action={
            <Link to="/workers" className={`${linkButton} bg-brand text-ink`}>
              {t('workers.backToList')}
            </Link>
          }
        />
      );
    return <QueryError error={error} onRetry={refetch} />;
  }

  const { worker, site, balance, recentAttendance, recentPayments } = data;
  const toggleActive = async (active) => {
    try {
      await setActive.mutateAsync({ id: worker._id, active });
      toast.success(
        active
          ? t('workers.reactivated', { name: worker.name })
          : t('workers.deactivated', { name: worker.name })
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setConfirmOff(false);
    }
  };

  return (
    <>
      <div className="mb-2">
        <Link to="/workers" className="text-sm font-semibold text-brand-ink hover:underline">
          ← {t('workers.title')}
        </Link>
      </div>
      <PageHeader
        title={
          <span className="flex items-center gap-4">
            <span
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-bold text-white"
              aria-hidden="true"
            >
              {initials(worker.name)}
            </span>
            <span>{worker.name}</span>
          </span>
        }
        documentTitle={worker.name}
        subtitle={`${t(`roles.${worker.role}`)} · ${site?.name ?? t('workers.noSite')}${worker.isActive ? '' : ` · ${t('common.inactive')}`}`}
        actions={
          <>
            <Link
              to={`/payments?record=1&workerId=${worker._id}`}
              className={`${linkButton} bg-brand text-ink`}
            >
              <HandCoins className="h-5 w-5" aria-hidden="true" />
              {t('dashboard.recordPayment')}
            </Link>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t('common.edit')}
            </Button>
          </>
        }
      />

      <div className="space-y-6">
        <BalanceCard balance={balance} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-bold">{t('workers.last60')}</h2>
            <WorkerCalendar records={recentAttendance} />
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold">{t('workers.details')}</h2>
            <dl className="mt-2 divide-y divide-border text-[0.95rem]">
              <Detail label={t('workers.dailyRate')}>
                <Money paise={worker.dailyRate} /> {t('workers.perDay')}
              </Detail>
              <Detail label={t('workers.phoneLabel')}>
                {worker.phone ? (
                  <a
                    href={`tel:+91${worker.phone}`}
                    className="inline-flex items-center gap-1.5 text-brand-ink hover:underline"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    {worker.phone}
                  </a>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label={t('workers.upiLabel')}>{worker.upiId ?? '—'}</Detail>
              <Detail label={t('workers.joinedOn')}>{formatDay(worker.joinedOn)}</Detail>
              <Detail label={t('workers.language')}>
                {worker.preferredLanguage === 'hi' ? 'हिन्दी' : 'English'}
              </Detail>
            </dl>
            <h3 className="mt-5 text-sm font-semibold text-ink-muted">
              {t('workers.rateHistory')}
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {[...worker.rateHistory].reverse().map((r) => (
                <li key={r.effectiveFrom} className="flex justify-between">
                  <span>{t('workers.fromDay', { day: formatDay(r.effectiveFrom) })}</span>
                  <Money paise={r.rate} className="font-semibold" />
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRateOpen(true)}
                disabled={!worker.isActive}
              >
                <IndianRupee className="h-4 w-4" aria-hidden="true" />
                {t('workers.changeRate')}
              </Button>
              {worker.isActive ? (
                <Button variant="ghost" size="sm" onClick={() => setConfirmOff(true)}>
                  <Power className="h-4 w-4" aria-hidden="true" />
                  {t('workers.deactivate')}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleActive(true)}
                  loading={setActive.isPending}
                >
                  <Power className="h-4 w-4" aria-hidden="true" />
                  {t('workers.reactivate')}
                </Button>
              )}
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{t('workers.recentPayments')}</h2>
            <Link
              to={`/payments?tab=history&workerId=${worker._id}`}
              className="text-sm font-semibold text-brand-ink hover:underline"
            >
              {t('workers.allPayments')}
            </Link>
          </div>
          {recentPayments.length === 0 ? (
            <p className="py-6 text-center text-ink-muted">{t('workers.noPayments')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentPayments.map((p) => (
                <li key={p._id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className={`font-medium ${p.voidedAt ? 'text-ink-muted line-through' : ''}`}>
                      {t(`payments.type.${p.type}`)} · {t(`payments.method.${p.method}`)}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {formatDay(p.day)}
                      {p.reference ? ` · UTR ${p.reference}` : ''}
                    </p>
                    {p.voidedAt && <p className="text-sm text-absent">{p.voidReason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.voidedAt && (
                      <span className="rounded-full bg-absent-soft px-2 py-0.5 text-xs font-semibold text-absent">
                        {t('payments.void')}
                      </span>
                    )}
                    <Money
                      paise={p.amount}
                      className={`font-semibold ${p.voidedAt ? 'text-ink-muted line-through' : ''}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <WorkerForm open={editOpen} worker={worker} onClose={() => setEditOpen(false)} />
      {rateOpen && <RateChangeDialog open worker={worker} onClose={() => setRateOpen(false)} />}
      <ConfirmDialog
        open={confirmOff}
        title={t('workers.deactivateTitle', { name: worker.name })}
        body={t('workers.deactivateBody')}
        confirmLabel={t('workers.deactivate')}
        loading={setActive.isPending}
        onConfirm={() => toggleActive(false)}
        onCancel={() => setConfirmOff(false)}
      />
    </>
  );
}
