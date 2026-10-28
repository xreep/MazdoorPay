import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Smartphone } from 'lucide-react';
import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { useMediaQuery } from '../../lib/hooks.js';
import { upiPayLink } from '../../lib/upi.js';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { lazyWithReload } from '../../lib/lazyWithReload.js';

// Only computers show the QR code, so only they load the QR library.
const QrCode = lazyWithReload(() => import('../../components/ui/QrCode.jsx'));

// UPI pay-assist, not a payment integration: hands the payment to the contractor's own UPI app.
export function UpiPayAssist({ worker, amount, type }) {
  const t = useT();
  const touch = useMediaQuery('(pointer: coarse)');
  // Recording a UPI payment for someone with no UPI ID on file is allowed (they may have been
  // paid on a UPI-linked number), but it must not go unnoticed.
  if (!worker.upiId)
    return (
      <div
        role="alert"
        className="flex gap-3 rounded-control border border-half bg-half-soft p-4 text-ink sm:col-span-2"
      >
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-half" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-semibold">{t('payments.upiMissingTitle', { name: worker.name })}</p>
          <p className="text-sm">{t('payments.upiMissingBody')}</p>
          <Link
            to={`/workers/${worker._id}`}
            className="inline-flex min-h-12 items-center text-sm font-semibold text-brand-ink underline"
          >
            {t('payments.upiMissingLink', { name: worker.name })}
          </Link>
        </div>
      </div>
    );
  if (!(amount > 0)) return null;

  const money = formatINR(amount);
  const link = upiPayLink({
    upiId: worker.upiId,
    name: worker.name,
    amount,
    note: `MazdoorPay ${t(`payments.type.${type}`)}`,
  });
  return (
    <div className="space-y-3 rounded-control bg-surface-2 p-4 sm:col-span-2">
      {touch ? (
        <a
          href={link}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-ink px-5 font-semibold text-on-ink"
        >
          <Smartphone className="h-5 w-5" aria-hidden="true" />
          {t('payments.payInUpiApp', { amount: money })}
        </a>
      ) : (
        <div className="flex items-center gap-4">
          <Suspense fallback={<Skeleton className="h-[176px] w-[176px]" />}>
            <QrCode
              value={link}
              label={t('payments.upiQrLabel', { amount: money, upiId: worker.upiId })}
            />
          </Suspense>
          <p className="text-[0.95rem]">
            {t('payments.scanToPay', { amount: money, upiId: worker.upiId })}
          </p>
        </div>
      )}
      <p className="text-sm text-ink-muted">{t('payments.upiConfirmHint')}</p>
    </div>
  );
}
