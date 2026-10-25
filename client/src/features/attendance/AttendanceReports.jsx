import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Download, Printer } from 'lucide-react';
import { dateRangeSchema, todayIST } from '@mazdoorpay/shared';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { downloadCsv } from '../../lib/download.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';

const recentMonths = (today, n = 6) =>
  Array.from({ length: n }, (_, i) => {
    const [y, m] = today.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7);
  });

const printLink =
  'inline-flex h-12 items-center justify-center gap-2 rounded-control border border-border bg-surface px-5 font-medium hover:bg-surface-2';

export function AttendanceReports({ siteId, siteName }) {
  const t = useT();
  const { formatMonth } = useFormat();
  const today = todayIST();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState(null);
  const range = dateRangeSchema.safeParse({ from, to });
  const rangeError = range.success ? null : range.error.issues[0].message;

  const run = async (key, fn) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <h2 className="text-lg font-bold">{t('attendance.musterTitle')}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t('attendance.musterBody', { site: siteName ?? '' })}
        </p>
        <Field label={t('attendance.month')} className="mt-4">
          <Select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            options={recentMonths(today).map((m) => ({ value: m, label: formatMonth(m) }))}
          />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            loading={busy === 'muster'}
            onClick={() =>
              run('muster', () =>
                downloadCsv('/reports/muster-roll', { month, siteId }, `muster-roll-${month}`)
              )
            }
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            {t('attendance.musterCsv')}
          </Button>
          <Link
            className={printLink}
            to={`/print/muster-roll?month=${month}&siteId=${siteId}`}
            target="_blank"
          >
            <Printer className="h-5 w-5" aria-hidden="true" />
            {t('attendance.print')}
          </Link>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-bold">{t('attendance.reportTitle')}</h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t('attendance.reportBody', { site: siteName ?? '' })}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label={t('attendance.from')}>
            <Input type="date" max={today} value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('attendance.to')} error={rangeError ?? undefined}>
            <Input type="date" max={today} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            disabled={!range.success}
            loading={busy === 'report'}
            onClick={() =>
              run('report', () =>
                downloadCsv(
                  '/reports/attendance',
                  { from, to, siteId },
                  `attendance-${from}-to-${to}`
                )
              )
            }
          >
            <Download className="h-5 w-5" aria-hidden="true" />
            {t('attendance.reportCsv')}
          </Button>
          {range.success && (
            <Link
              className={printLink}
              to={`/print/attendance?from=${from}&to=${to}&siteId=${siteId}`}
              target="_blank"
            >
              <Printer className="h-5 w-5" aria-hidden="true" />
              {t('attendance.print')}
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
