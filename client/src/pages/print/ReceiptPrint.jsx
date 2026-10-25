import { useParams } from 'react-router-dom';
import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { formatDayLong } from '../../lib/format.js';
import { PrintLayout } from '../../components/layout/PrintLayout.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { usePayment } from '../../features/payments/usePayments.js';

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-6 border-b border-neutral-300 py-2.5">
      <dt className="text-neutral-600">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

export default function ReceiptPrint() {
  const t = useT();
  const { id } = useParams();
  const { data, isPending, isError, error } = usePayment(id);
  if (isPending)
    return (
      <div className="p-8">
        <SkeletonRows n={6} />
      </div>
    );
  if (isError)
    return (
      <div className="p-8">
        <QueryError error={error} />
      </div>
    );
  const { payment, worker, site, contractor } = data;
  const voided = Boolean(payment.voidedAt);
  return (
    <PrintLayout
      title={t('print.receiptTitle')}
      subtitle={t('print.receiptNo', { no: payment._id.slice(-8).toUpperCase() })}
      meta={contractor.phone ? `${contractor.name} · ${contractor.phone}` : contractor.name}
    >
      <div className="relative mx-auto max-w-md">
        {voided && (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="-rotate-12 rounded border-4 border-red-600 px-6 py-2 text-5xl font-black tracking-widest text-red-600 opacity-70">
              {t('print.voidStamp')}
            </span>
          </div>
        )}
        <p className="text-center text-sm text-neutral-600">{t('print.paidTo')}</p>
        <p className="text-center text-2xl font-bold">{worker?.name}</p>
        <p className="num my-6 text-center text-5xl font-bold">{formatINR(payment.amount)}</p>
        <dl>
          <Row label={t('print.date')}>{formatDayLong(payment.day)}</Row>
          <Row label={t('payments.typeLabel')}>{t(`payments.type.${payment.type}`)}</Row>
          <Row label={t('payments.methodLabel')}>{t(`payments.method.${payment.method}`)}</Row>
          {payment.reference && (
            <Row label={payment.method === 'upi' ? t('payments.utr') : t('payments.bankRefShort')}>
              {payment.reference}
            </Row>
          )}
          {site && <Row label={t('workers.site')}>{site.name}</Row>}
          {worker?.role && <Row label={t('workers.role')}>{t(`roles.${worker.role}`)}</Row>}
          {payment.notes && <Row label={t('payments.notes')}>{payment.notes}</Row>}
          {voided && <Row label={t('print.voidReason')}>{payment.voidReason}</Row>}
        </dl>
        <div className="mt-12 border-t border-black pt-2 text-sm">{t('print.workerSignature')}</div>
      </div>
    </PrintLayout>
  );
}
