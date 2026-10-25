import { Suspense, lazy, useEffect, useState } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import {
  Building2,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Save,
  ScanLine,
  Undo2,
} from 'lucide-react';
import { LIMITS, addDays, diffDays, isValidDay, todayIST } from '@mazdoorpay/shared';
import { useT } from '../lib/i18n.jsx';
import { formatDayLong } from '../lib/format.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button, buttonClasses } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Input } from '../components/ui/Input.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';
import { Select } from '../components/ui/Select.jsx';
import { SkeletonRows } from '../components/ui/Skeleton.jsx';
import { Tabs } from '../components/ui/Tabs.jsx';
import { useSiteOptions } from '../features/sites/useSites.js';
import { useAttendanceSheet, useMarkAttendance } from '../features/attendance/useAttendance.js';
import { useAttendanceDraft } from '../features/attendance/useAttendanceDraft.js';
import { AttendanceGrid } from '../features/attendance/AttendanceGrid.jsx';
import { MonthHeatmap } from '../features/attendance/MonthHeatmap.jsx';
import { AttendanceReports } from '../features/attendance/AttendanceReports.jsx';
import { setUnsavedCount } from '../lib/unsaved.js';

// The camera library loads only when someone starts scanning.
const ScanDialog = lazy(() =>
  import('../features/attendance/ScanDialog.jsx').then((m) => ({ default: m.ScanDialog }))
);

const unsavedLabel = (t, n) =>
  n === 1 ? t('attendance.unsavedOne') : t('attendance.unsavedMany', { n });

function ReasonDialog({ open, onCancel, onSave, saving }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 3;
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('attendance.reasonTitle')}
      description={t('attendance.reasonBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => onSave(reason.trim())} disabled={!valid} loading={saving}>
            {t('attendance.save')}
          </Button>
        </>
      }
    >
      <Field label={t('attendance.reason')} hint={t('attendance.reasonHint')}>
        <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

function SummaryChips({ sheet, draft }) {
  const t = useT();
  const count = (status) =>
    sheet.workers.filter((w) => draft.statusOf(w.workerId) === status).length;
  const notMarked = sheet.workers.filter((w) => w.isActive && !draft.statusOf(w.workerId)).length;
  const chips = [
    ['status.present', count('present'), 'bg-present-soft text-present'],
    ['status.halfDay', count('half-day'), 'bg-half-soft text-half'],
    ['status.absent', count('absent'), 'bg-absent-soft text-absent'],
    ['status.notMarked', notMarked, 'bg-surface-2 text-ink-muted'],
  ];
  return (
    <ul className="flex flex-wrap gap-2" aria-label={t('attendance.summary')}>
      {chips.map(([key, n, tone]) => (
        <li key={key} className={`num rounded-full px-3 py-1.5 text-sm font-semibold ${tone}`}>
          {t(key)} · {n}
        </li>
      ))}
    </ul>
  );
}

function AttendanceSheet({ siteId, day, onDirtyChange }) {
  const t = useT();
  const { data: sheet, isPending, isError, error, refetch } = useAttendanceSheet(siteId, day);
  const draft = useAttendanceDraft(sheet);
  const mark = useMarkAttendance(siteId);
  const [errors, setErrors] = useState(new Map());
  const [askReason, setAskReason] = useState(false);
  const needsReason = diffDays(day, todayIST()) > LIMITS.BACKDATE_REASON_DAYS;

  useEffect(() => onDirtyChange(draft.dirtyCount), [draft.dirtyCount, onDirtyChange]);
  useEffect(() => {
    if (!draft.dirtyCount) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [draft.dirtyCount]);

  const save = async (reason) => {
    try {
      const sent = draft.changes;
      const result = await mark.mutateAsync({ day, records: sent, ...(reason ? { reason } : {}) });
      setErrors(new Map(result.errors.map((e) => [e.workerId, e.error])));
      draft.settle(
        sent,
        result.errors.map((e) => e.workerId)
      );
      if (result.saved)
        toast.success(
          result.saved === 1
            ? t('attendance.savedOne')
            : t('attendance.savedMany', { n: result.saved })
        );
      if (result.errors.length)
        toast.error(t('attendance.someRefused', { n: result.errors.length }));
      setAskReason(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (isPending) return <SkeletonRows n={6} className="h-[4.5rem]" />;
  if (isError) return <QueryError error={error} onRetry={refetch} />;
  if (!sheet.workers.length) {
    return (
      <Card>
        <EmptyState
          icon={Building2}
          title={t('attendance.noWorkersTitle')}
          body={t('attendance.noWorkersBody')}
          action={
            <Link
              to={`/workers?new=1&siteId=${siteId}`}
              className="inline-flex h-12 items-center rounded-control bg-brand px-5 font-semibold text-ink"
            >
              {t('workers.addTitle')}
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SummaryChips sheet={sheet} draft={draft} />
        <Button variant="secondary" onClick={draft.markAllPresent}>
          <CheckCheck className="h-5 w-5" aria-hidden="true" />
          {t('attendance.markAll')}
        </Button>
      </div>
      <Card className="overflow-hidden">
        <AttendanceGrid sheet={sheet} draft={draft} errors={errors} />
      </Card>

      <AnimatePresence>
        {draft.dirtyCount > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="sticky bottom-[5.25rem] z-20 mt-4 lg:bottom-6"
          >
            <div className="flex items-center gap-2 rounded-card bg-ink p-2.5 pl-4 text-white shadow-lift sm:gap-3 sm:p-3 sm:pl-5">
              <p
                className="num min-w-0 flex-1 text-sm font-semibold leading-tight sm:text-base"
                aria-live="polite"
              >
                <span className="sr-only sm:not-sr-only">{unsavedLabel(t, draft.dirtyCount)}</span>
                <span className="sm:hidden" aria-hidden="true">
                  <span className="text-lg">{draft.dirtyCount}</span> {t('attendance.unsavedShort')}
                </span>
              </p>
              <Button
                variant="ghost"
                className="shrink-0 px-3 text-white hover:bg-white/10"
                onClick={draft.undo}
                disabled={!draft.canUndo}
                aria-label={t('attendance.undo')}
              >
                <Undo2 className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('attendance.undo')}</span>
              </Button>
              <Button
                className="shrink-0 whitespace-nowrap"
                onClick={() => (needsReason ? setAskReason(true) : save())}
                loading={mark.isPending && !askReason}
              >
                <Save className="h-5 w-5" aria-hidden="true" />
                {t('attendance.save')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {askReason && (
        <ReasonDialog
          open
          onCancel={() => setAskReason(false)}
          onSave={save}
          saving={mark.isPending}
        />
      )}
    </>
  );
}

export default function AttendancePage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const today = todayIST();
  const { options: siteOptions, isPending: sitesPending } = useSiteOptions();
  const siteId = params.get('siteId') || siteOptions[0]?.value || '';
  const dayParam = params.get('day');
  const day = isValidDay(dayParam) && dayParam <= today ? dayParam : today;
  const tab = params.get('tab') ?? 'mark';
  const [dirty, setDirty] = useState(0);
  const [pendingSwitch, setPendingSwitch] = useState(null);
  const [scanning, setScanning] = useState(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty > 0 && currentLocation.pathname !== nextLocation.pathname
  );
  const siteName = siteOptions.find((o) => o.value === siteId)?.label;

  // Lets the shell ask before logging out with unsaved marks.
  useEffect(() => {
    setUnsavedCount(dirty);
    return () => setUnsavedCount(0);
  }, [dirty]);

  const apply = (next) =>
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { replace: true });
  const go = (changes) => {
    const next = {
      siteId,
      day: day === today ? '' : day,
      tab: tab === 'mark' ? '' : tab,
      ...changes,
    };
    const nextDay = next.day || today;
    if (dirty > 0 && (next.siteId !== siteId || nextDay !== day || next.tab))
      setPendingSwitch(next);
    else apply(next);
  };

  const discardOpen = Boolean(pendingSwitch) || blocker.state === 'blocked';
  const discard = () => {
    setDirty(0);
    if (blocker.state === 'blocked') blocker.proceed();
    if (pendingSwitch) apply(pendingSwitch);
    setPendingSwitch(null);
  };
  const keep = () => {
    if (blocker.state === 'blocked') blocker.reset();
    setPendingSwitch(null);
  };

  const dayBtn =
    'flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-border bg-surface hover:bg-surface-2 disabled:opacity-40';

  if (!sitesPending && !siteOptions.length) {
    return (
      <>
        <PageHeader title={t('nav.attendance')} />
        <Card>
          <EmptyState
            icon={Building2}
            title={t('attendance.noSitesTitle')}
            body={t('attendance.noSitesBody')}
            action={
              <Link
                to="/sites?new=1"
                className="inline-flex h-12 items-center rounded-control bg-brand px-5 font-semibold text-ink"
              >
                {t('dashboard.addFirstSite')}
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t('nav.attendance')}
        subtitle={formatDayLong(day)}
        actions={
          <>
            {day === today && (
              <Button variant="secondary" onClick={() => setScanning(true)}>
                <ScanLine className="h-5 w-5" aria-hidden="true" />
                {t('attendance.scan')}
              </Button>
            )}
            {siteId && (
              <Link
                to={`/print/cards?siteId=${siteId}`}
                className={buttonClasses({ variant: 'ghost' })}
              >
                <IdCard className="h-5 w-5" aria-hidden="true" />
                {t('attendance.printCards')}
              </Link>
            )}
          </>
        }
      />
      {scanning && (
        <Suspense fallback={null}>
          <ScanDialog open onClose={() => setScanning(false)} />
        </Suspense>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label={t('workers.site')}>
          <Select
            options={siteOptions}
            value={siteId}
            onChange={(e) => go({ siteId: e.target.value })}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium" aria-hidden="true">
            {t('attendance.day')}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className={dayBtn}
              onClick={() => go({ day: addDays(day, -1) })}
              aria-label={t('attendance.prevDay')}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <Input
              type="date"
              aria-label={t('attendance.day')}
              max={today}
              value={day}
              onChange={(e) => isValidDay(e.target.value) && go({ day: e.target.value })}
              className="w-[11.5rem]"
            />
            <button
              type="button"
              className={dayBtn}
              onClick={() => go({ day: addDays(day, 1) })}
              disabled={day >= today}
              aria-label={t('attendance.nextDay')}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <Tabs
        className="mb-5"
        label={t('nav.attendance')}
        value={tab}
        onChange={(id) => go({ tab: id === 'mark' ? '' : id })}
        tabs={[
          { id: 'mark', label: t('attendance.tabMark') },
          { id: 'calendar', label: t('attendance.tabCalendar') },
          { id: 'reports', label: t('attendance.tabReports') },
        ]}
      />

      {siteId && tab === 'mark' && (
        <AttendanceSheet
          key={`${siteId}-${day}`}
          siteId={siteId}
          day={day}
          onDirtyChange={setDirty}
        />
      )}
      {siteId && tab === 'calendar' && (
        <Card className="p-5">
          <MonthHeatmap
            siteId={siteId}
            onPickDay={(d) => go({ day: d === today ? '' : d, tab: '' })}
          />
        </Card>
      )}
      {siteId && tab === 'reports' && <AttendanceReports siteId={siteId} siteName={siteName} />}

      <ConfirmDialog
        open={discardOpen}
        title={dirty === 1 ? t('attendance.discardOne') : t('attendance.discardMany', { n: dirty })}
        body={t('attendance.discardBody')}
        confirmLabel={t('attendance.discard')}
        onConfirm={discard}
        cancelLabel={t('attendance.keepEditing')}
        onCancel={keep}
      />
    </>
  );
}
