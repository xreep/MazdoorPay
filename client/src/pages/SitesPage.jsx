import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useT } from '../lib/i18n.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { QueryError } from '../components/ui/QueryError.jsx';
import { SkeletonRows } from '../components/ui/Skeleton.jsx';
import { SiteForm } from '../features/sites/SiteForm.jsx';
import { useDeleteSite, useSites, useUpdateSite } from '../features/sites/useSites.js';

function SiteCard({ site, onEdit, onDelete }) {
  const t = useT();
  const update = useUpdateSite();
  const titleId = `site-${site._id}`;
  const toggle = async () => {
    try {
      await update.mutateAsync({ id: site._id, isActive: !site.isActive });
      toast.success(site.isActive ? t('sites.markedInactive') : t('sites.markedActive'));
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <article
      aria-labelledby={titleId}
      className={`flex flex-col rounded-card bg-surface p-5 shadow-card ${site.isActive ? '' : 'opacity-80'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-lg font-semibold leading-snug">
          {site.name}
        </h2>
        {!site.isActive && (
          <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-muted">
            {t('common.inactive')}
          </span>
        )}
      </div>
      {site.location && (
        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {site.location}
        </p>
      )}
      <Link
        to={`/workers?siteId=${site._id}`}
        className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium hover:bg-ink/10"
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        <span className="num">
          {t('sites.workerCounts', { active: site.activeWorkers, total: site.totalWorkers })}
        </span>
      </Link>
      <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
        <Button variant="secondary" size="sm" onClick={() => onEdit(site)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t('common.edit')}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggle} loading={update.isPending}>
          {site.isActive ? t('sites.markInactive') : t('sites.markActive')}
        </Button>
        <button
          type="button"
          onClick={() => onDelete(site)}
          aria-label={t('sites.delete')}
          className="ml-auto flex h-10 w-10 items-center justify-center rounded-control text-ink-muted hover:bg-absent-soft hover:text-absent"
        >
          <Trash2 className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export default function SitesPage() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { data: sites, isPending, isError, error, refetch } = useSites('all');
  const remove = useDeleteSite();
  const formOpen = params.get('new') === '1' || Boolean(editing);

  const openNew = () => setParams({ new: '1' }, { replace: true });
  const closeForm = () => {
    setEditing(null);
    if (params.has('new')) setParams({}, { replace: true });
  };

  const confirmDelete = async () => {
    const site = deleting;
    try {
      await remove.mutateAsync(site._id);
      toast.success(t('sites.deleted', { name: site.name }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title={t('sites.title')}
        subtitle={t('sites.subtitle')}
        actions={
          <Button onClick={openNew}>
            <Plus className="h-5 w-5" aria-hidden="true" />
            {t('sites.addTitle')}
          </Button>
        }
      />
      {isPending && <SkeletonRows n={3} className="h-44" />}
      {isError && <QueryError error={error} onRetry={refetch} />}
      {sites && sites.length === 0 && (
        <Card>
          <EmptyState
            icon={Building2}
            title={t('sites.emptyTitle')}
            body={t('sites.emptyBody')}
            action={
              <Button onClick={openNew}>
                <Plus className="h-5 w-5" aria-hidden="true" />
                {t('sites.addTitle')}
              </Button>
            }
          />
        </Card>
      )}
      {sites && sites.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map((site) => (
            <SiteCard key={site._id} site={site} onEdit={setEditing} onDelete={setDeleting} />
          ))}
        </div>
      )}
      <SiteForm open={formOpen} site={editing} onClose={closeForm} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('sites.deleteTitle', { name: deleting?.name ?? '' })}
        body={t('sites.deleteBody')}
        confirmLabel={t('sites.delete')}
        loading={remove.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
