import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, HandCoins, Printer, Receipt, Wallet } from 'lucide-react';
import { PAYMENT_METHODS, dateRangeSchema, formatINR, todayIST } from '@mazdoorpay/shared';
import { useFormat, useT } from '../lib/i18n.jsx';
import { downloadCsv } from '../lib/download.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Money } from '../components/ui/Money.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';
import { Select } from '../components/ui/Select.jsx';
import { SkeletonRows } from '../components/ui/Skeleton.jsx';
import { Tabs } from '../components/ui/Tabs.jsx';
import { useSiteOptions } from '../features/sites/useSites.js';
import { useWorkers } from '../features/workers/useWorkers.js';
import { useDues, usePaymentHistory } from '../features/payments/usePayments.js';
import { RecordPaymentModal } from '../features/payments/RecordPaymentModal.jsx';
import { VoidPaymentDialog } from '../features/payments/VoidPaymentDialog.jsx';

function BalanceList({ rows, kind, onPay }) {
  const t = useT();
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.workerId} className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <Link
              to={`/workers/${r.workerId}`}
              className="block truncate font-semibold hover:underline"
            >
              {r.name}
            </Link>
            <p className="truncate text-sm text-ink-muted">
              {t(`roles.${r.role}`)} · {r.siteName ?? t('workers.noSite')}
              {!r.isActive && ` · ${t('common.inactive')}`}
            </p>
            <p className="num hidden text-xs text-ink-muted sm:block">
              {t('payments.earnedPaid', { earned: formatINR(r.earned), paid: formatINR(r.paid) })}
            </p>
          </div>
          <p
            className={`num shrink-0 text-lg font-bold ${kind === 'advance' ? 'text-brand-ink' : ''}`}
          >
            {formatINR(Math.abs(r.balance))}
          </p>
          {kind === 'due' && (
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => onPay(r.workerId)}
              aria-label={t('payments.payWorker', { name: r.name })}
            >
              <HandCoins className="h-4 w-4" aria-hidden="true" />
              {t('payments.pay')}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function DuesTab({ kind, onPay }) {
  const t = useT();
  const [siteId, setSiteId] = useState('');
  const { options } = useSiteOptions();
  const { data, isPending, isError, error, refetch } = useDues(siteId || undefined);
  const rows = kind === 'due' ? data?.dues : data?.advances;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="num text-lg font-semibold" aria-live="polite">
          {data &&
            (kind === 'due'
              ? t('payments.pendingTotal', {
                  amount: formatINR(data.totals.pending),
                  n: data.totals.workersWithDues,
                })
              : t('payments.advanceTotal', { amount: formatINR(data.totals.advance) }))}
        </p>
        <Field label={t('workers.site')} className="w-full sm:w-72 [&>label]:sr-only">
          <Select
            placeholder={t('workers.allSites')}
            options={options}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
          />
        </Field>
      </div>
      {isPending && <SkeletonRows n={5} className="h-16" />}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {rows && rows.length === 0 && (
        <Card>
          <EmptyState
            icon={Wallet}
            title={kind === 'due' ? t('payments.allPaidTitle') : t('payments.noAdvancesTitle')}
            body={kind === 'due' ? t('payments.allPaidBody') : t('payments.noAdvancesBody')}
          />
        </Card>
      )}
      {rows && rows.length > 0 && (
        <Card className="overflow-hidden">
          <BalanceList rows={rows} kind={kind} onPay={onPay} />
        </Card>
      )}
    </>
  );
}

function PaymentItem({ payment, onVoid }) {
  const t = useT();
  const { formatDay } = useFormat();
  const voided = Boolean(payment.voidedAt);
  const titleId = `pay-${payment._id}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:px-5"
    >
      <div className="min-w-0 flex-1">
        <p id={titleId} className={`font-semibold ${voided ? 'text-ink-muted line-through' : ''}`}>
          {payment.worker?.name ?? '—'}
        </p>
        <p className="text-sm text-ink-muted">
          {formatDay(payment.day)} · {t(`payments.type.${payment.type}`)} ·{' '}
          {t(`payments.method.${payment.method}`)}
          {payment.reference && (
            <>
              <span aria-hidden="true"> · </span>
              <span>{t('payments.utrShort', { ref: payment.reference })}</span>
            </>
          )}
        </p>
        {voided && (
          <p className="mt-0.5 text-sm text-absent">
            <span className="mr-2 rounded-full bg-absent-soft px-2 py-0.5 text-xs font-semibold">
              {t('payments.void')}
            </span>
            {payment.voidReason}
          </p>
        )}
      </div>
      <Money
        paise={payment.amount}
        className={`text-lg font-bold ${voided ? 'text-ink-muted line-through' : ''}`}
      />
      <div className="flex gap-1">
        <Link
          to={`/print/receipt/${payment._id}`}
          target="_blank"
          className="inline-flex h-12 items-center gap-1.5 rounded-control px-3 text-sm font-medium hover:bg-ink/5"
        >
          <Receipt className="h-4 w-4" aria-hidden="true" />
          {t('payments.receipt')}
        </Link>
        {!voided && (
          <Button variant="ghost" size="sm" onClick={() => onVoid(payment)}>
            {t('payments.voidAction')}
          </Button>
        )}
      </div>
    </article>
  );
}

function HistoryTab({ initialWorkerId }) {
  const t = useT();
  const today = todayIST();
  const [filters, setFilters] = useState({
    workerId: initialWorkerId ?? '',
    siteId: '',
    method: '',
    from: `${today.slice(0, 7)}-01`,
    to: today,
    includeVoided: false,
  });
  const [pageNo, setPageNo] = useState(1);
  const [voiding, setVoiding] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const { options: siteOptions } = useSiteOptions();
  const { data: workersPage } = useWorkers({ status: 'all', limit: 100 });
  const range = dateRangeSchema.safeParse({ from: filters.from, to: filters.to });
  const query = {
    ...filters,
    includeVoided: filters.includeVoided ? 'true' : undefined,
    page: pageNo,
    ...(range.success ? {} : { from: undefined, to: undefined }),
  };
  const { data, isPending, isError, error, refetch, isFetching } = usePaymentHistory(query);
  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setFilters((f) => ({ ...f, [key]: value }));
    setPageNo(1);
  };
  const reportQuery = {
    from: filters.from,
    to: filters.to,
    siteId: filters.siteId,
    includeVoided: filters.includeVoided ? 'true' : undefined,
  };
  const printHref = `/print/payments?${new URLSearchParams(Object.entries(reportQuery).filter(([, v]) => v)).toString()}`;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadCsv(
        '/reports/payments',
        reportQuery,
        `payments-${filters.from}-to-${filters.to}`
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t('payments.worker')}>
          <Select
            placeholder={t('payments.allWorkers')}
            options={(workersPage?.data ?? []).map((w) => ({ value: w._id, label: w.name }))}
            value={filters.workerId}
            onChange={set('workerId')}
          />
        </Field>
        <Field label={t('workers.site')}>
          <Select
            placeholder={t('workers.allSites')}
            options={siteOptions}
            value={filters.siteId}
            onChange={set('siteId')}
          />
        </Field>
        <Field label={t('payments.methodLabel')}>
          <Select
            placeholder={t('payments.allMethods')}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`payments.method.${m}`) }))}
            value={filters.method}
            onChange={set('method')}
          />
        </Field>
        <Field label={t('attendance.from')}>
          <Input type="date" max={today} value={filters.from} onChange={set('from')} />
        </Field>
        <Field
          label={t('attendance.to')}
          error={range.success ? undefined : range.error.issues[0].message}
        >
          <Input type="date" max={today} value={filters.to} onChange={set('to')} />
        </Field>
        <label className="flex h-12 cursor-pointer items-center gap-3 self-end rounded-control px-1 font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 accent-[hsl(var(--brand))]"
            checked={filters.includeVoided}
            onChange={set('includeVoided')}
          />
          {t('payments.showVoided')}
        </label>
      </Card>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={download}
          loading={downloading}
          disabled={!range.success}
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          {t('payments.downloadReport')}
        </Button>
        <Link
          to={printHref}
          target="_blank"
          className="inline-flex h-12 items-center gap-2 rounded-control border border-border bg-surface px-5 font-medium hover:bg-surface-2"
        >
          <Printer className="h-5 w-5" aria-hidden="true" />
          {t('payments.printReport')}
        </Link>
      </div>
      {isPending && <SkeletonRows n={5} className="h-16" />}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {data && data.data.length === 0 && (
        <Card>
          <EmptyState
            icon={Receipt}
            title={t('payments.noHistoryTitle')}
            body={t('payments.noHistoryBody')}
          />
        </Card>
      )}
      {data && data.data.length > 0 && (
        <Card
          className={`divide-y divide-border overflow-hidden ${isFetching ? 'opacity-70' : ''}`}
        >
          {data.data.map((p) => (
            <PaymentItem key={p._id} payment={p} onVoid={setVoiding} />
          ))}
        </Card>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onChange={setPageNo} />}
      {voiding && <VoidPaymentDialog payment={voiding} onClose={() => setVoiding(null)} />}
    </>
  );
}

export default function PaymentsPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'dues';
  const recordOpen = params.get('record') === '1';
  const recordWorker = params.get('workerId') ?? undefined;
  const { data: dues } = useDues(undefined);

  const update = (changes) =>
    setParams(
      (p) => {
        const next = { ...Object.fromEntries(p), ...changes };
        return Object.fromEntries(Object.entries(next).filter(([, v]) => v));
      },
      { replace: true }
    );

  return (
    <>
      <PageHeader
        title={t('nav.payments')}
        subtitle={t('payments.subtitle')}
        actions={
          <Button onClick={() => update({ record: '1', workerId: '' })}>
            <HandCoins className="h-5 w-5" aria-hidden="true" />
            {t('dashboard.recordPayment')}
          </Button>
        }
      />
      <Tabs
        className="mb-5"
        label={t('nav.payments')}
        value={tab}
        onChange={(id) => update({ tab: id === 'dues' ? '' : id, workerId: '' })}
        tabs={[
          { id: 'dues', label: t('payments.tabDues'), count: dues?.dues.length },
          { id: 'advances', label: t('payments.tabAdvances'), count: dues?.advances.length },
          { id: 'history', label: t('payments.tabHistory') },
        ]}
      />
      {tab === 'dues' && (
        <DuesTab kind="due" onPay={(workerId) => update({ record: '1', workerId })} />
      )}
      {tab === 'advances' && <DuesTab kind="advance" />}
      {tab === 'history' && <HistoryTab initialWorkerId={recordOpen ? undefined : recordWorker} />}
      {recordOpen && (
        <RecordPaymentModal
          open
          workerId={recordWorker}
          onClose={() => update({ record: '', workerId: '' })}
        />
      )}
    </>
  );
}
