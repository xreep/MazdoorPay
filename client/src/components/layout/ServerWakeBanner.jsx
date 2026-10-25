import { useEffect, useState } from 'react';
import { Coffee } from 'lucide-react';
import { onSlowRequest } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';

export function ServerWakeBanner() {
  const t = useT();
  const [slow, setSlow] = useState(false);
  useEffect(() => onSlowRequest(setSlow), []);
  if (!slow) return null;
  return (
    <div role="status" className="no-print fixed inset-x-0 top-0 z-50 flex justify-center p-3">
      <div className="flex items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-sm text-on-ink shadow-lift">
        <Coffee className="h-4 w-4 text-brand" aria-hidden="true" />
        {t('app.waking')}
      </div>
    </div>
  );
}
