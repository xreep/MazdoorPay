import { Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { useT } from '../../lib/i18n.jsx';
import { PrintLayout } from '../../components/layout/PrintLayout.jsx';
import { Logo } from '../../components/layout/Logo.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';

const QrCode = lazy(() => import('../../components/ui/QrCode.jsx'));

// Credit-card-sized worker ID cards (85.6 × 54 mm), ten to an A4 sheet, to cut out and laminate.
export default function IdCardsPrint() {
  const t = useT();
  const [params] = useSearchParams();
  const query = {
    siteId: params.get('siteId') ?? undefined,
    workerId: params.get('workerId') ?? undefined,
  };
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['worker-cards', query],
    queryFn: () => api.get('/workers/cards', { query }),
  });
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

  return (
    <PrintLayout
      title={t('cards.title')}
      subtitle={t('cards.subtitle')}
      meta={data.contractor.name}
      signatures={false}
    >
      {data.cards.length === 0 ? (
        <p className="text-neutral-600">{t('cards.none')}</p>
      ) : (
        <ul
          aria-label={t('cards.title')}
          className="grid grid-cols-[repeat(auto-fill,85.6mm)] gap-4"
        >
          {data.cards.map(({ worker, site, code }) => (
            <li
              key={worker._id}
              className="flex h-[54mm] w-[85.6mm] break-inside-avoid items-center gap-3 rounded-lg border border-neutral-400 p-3"
            >
              <div className="flex h-full min-w-0 flex-1 flex-col justify-between">
                <div className="origin-left scale-75">
                  <Logo />
                </div>
                <div>
                  <p className="text-lg font-bold leading-tight">{worker.name}</p>
                  <p className="text-sm">
                    {t(`roles.${worker.role}`)}
                    {site ? ` · ${site.name}` : ''}
                  </p>
                </div>
                <p className="text-xs text-neutral-600">
                  {t('cards.issuedBy', { name: data.contractor.name })}
                </p>
              </div>
              <Suspense fallback={<div className="h-[34mm] w-[34mm]" />}>
                <QrCode value={code} label={t('cards.qrFor', { name: worker.name })} size={128} />
              </Suspense>
            </li>
          ))}
        </ul>
      )}
    </PrintLayout>
  );
}
