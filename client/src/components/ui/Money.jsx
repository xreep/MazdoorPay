import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';

// tone="auto": a negative balance is an advance the worker still holds.
export function Money({ paise, tone = 'plain', className = '' }) {
  const t = useT();
  if (paise == null) return <span className={className}>—</span>;
  if (tone === 'auto' && paise < 0) {
    return (
      <span className={`num font-semibold text-brand-ink ${className}`}>
        {t('money.advance', { amount: formatINR(-paise) })}
      </span>
    );
  }
  return <span className={`num ${className}`}>{formatINR(paise)}</span>;
}
