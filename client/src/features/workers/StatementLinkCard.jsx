import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Link2, Link2Off } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { statementMessage } from '../../lib/whatsapp.js';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { WhatsAppLink } from '../../components/ui/WhatsAppLink.jsx';
import { useMakeStatementLink, useStatementLink, useStopStatementLink } from './useWorkers.js';

const dayOf = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// A private page the worker can open without logging in. Only a hash of its token is kept,
// so the full link is shown once, right after it is made.
export function StatementLinkCard({ worker }) {
  const t = useT();
  const { formatDay } = useFormat();
  const { user } = useAuth();
  const { data: status } = useStatementLink(worker._id);
  const make = useMakeStatementLink();
  const stop = useStopStatementLink();
  const [url, setUrl] = useState(null);

  const create = async () => {
    try {
      const { path } = await make.mutateAsync(worker._id);
      setUrl(`${window.location.origin}${path}`);
    } catch (err) {
      toast.error(err.message);
    }
  };
  const end = async () => {
    try {
      await stop.mutateAsync(worker._id);
      setUrl(null);
      toast.success(t('statement.stopped'));
    } catch (err) {
      toast.error(err.message);
    }
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('statement.copied'));
    } catch {
      // Clipboard blocked: the link is selectable in the box.
    }
  };

  return (
    <Card as="section" aria-label={t('statement.section')} className="p-5">
      <h2 className="text-lg font-bold">{t('statement.section')}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t('statement.sectionHint')}</p>

      {url ? (
        <div className="mt-4 space-y-3">
          <Input
            readOnly
            value={url}
            aria-label={t('statement.linkLabel', { name: worker.name })}
            onFocus={(e) => e.target.select()}
          />
          <p className="text-sm text-ink-muted">{t('statement.shownOnce')}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={copy}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              {t('statement.copy')}
            </Button>
            <WhatsAppLink
              phone={worker.phone}
              message={statementMessage({ worker, url, contractorName: user?.name })}
              className="h-12 px-4 text-sm"
            >
              {t('whatsapp.sendReceipt')}
            </WhatsAppLink>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-[0.95rem]">
          {status?.active
            ? `${t('statement.activeSince', { day: formatDay(dayOf(status.createdAt)) })} · ${
                status.lastViewedAt
                  ? t('statement.lastViewed', { day: formatDay(dayOf(status.lastViewedAt)) })
                  : t('statement.neverViewed')
              }`
            : status && t('statement.none')}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="secondary" size="sm" onClick={create} loading={make.isPending}>
          <Link2 className="h-4 w-4" aria-hidden="true" />
          {status?.active || url ? t('statement.remake') : t('statement.make')}
        </Button>
        {(status?.active || url) && (
          <Button variant="ghost" size="sm" onClick={end} loading={stop.isPending}>
            <Link2Off className="h-4 w-4" aria-hidden="true" />
            {t('statement.stop')}
          </Button>
        )}
      </div>
      {status?.active && !url && (
        <p className="mt-2 text-sm text-ink-muted">{t('statement.remakeHint')}</p>
      )}
    </Card>
  );
}
