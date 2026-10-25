import { CloudOff } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';
import { Button } from './Button.jsx';

export function QueryError({ error, onRetry }) {
  const t = useT();
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-card border border-dashed border-border px-6 py-10 text-center"
    >
      <CloudOff className="h-8 w-8 text-ink-muted" aria-hidden="true" />
      <p className="mt-3 max-w-sm text-ink">
        {t('common.loadFailed', { message: error?.message ?? '' })}
      </p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={() => onRetry()}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}
