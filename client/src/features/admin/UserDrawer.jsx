import { useState } from 'react';
import { toast } from 'sonner';
import { formatINR } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Money } from '../../components/ui/Money.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { SkeletonRows } from '../../components/ui/Skeleton.jsx';
import { QueryError } from '../../components/ui/QueryError.jsx';
import { useAdminUser, useAdminUserWorkers, useSetUserStatus } from './useAdmin.js';

function SuspendDialog({ user, onClose }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const setStatus = useSetUserStatus();
  const submit = async () => {
    try {
      await setStatus.mutateAsync({ id: user._id, suspend: true, reason: reason.trim() });
      toast.success(t('admin.suspended', { name: user.name }));
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('admin.suspendTitle', { name: user.name })}
      description={t('admin.suspendBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3}
            loading={setStatus.isPending}
            onClick={submit}
          >
            {t('admin.suspend')}
          </Button>
        </>
      }
    >
      <Field label={t('attendance.reason')}>
        <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}

export function UserDrawer({ userId, onClose }) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState(false);
  const detail = useAdminUser(userId);
  const workers = useAdminUserWorkers(
    detail.data?.user.role === 'contractor' ? userId : undefined,
    { page }
  );
  const setStatus = useSetUserStatus();
  const user = detail.data?.user;

  const reactivate = async () => {
    try {
      await setStatus.mutateAsync({ id: user._id, suspend: false });
      toast.success(t('admin.reactivated', { name: user.name }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={user?.name ?? t('admin.loadingUser')}
      description={user?.email}
      variant="drawer"
    >
      {detail.isPending && <SkeletonRows n={6} />}
      {detail.isError && <QueryError error={detail.error} onRetry={detail.refetch} />}
      {user && (
        <div className="space-y-6">
          {user.status === 'suspended' && (
            <p className="rounded-control bg-absent-soft px-3.5 py-3 text-sm text-absent">
              <strong>{t('admin.statusSuspended')}</strong>
              {user.suspendedReason && ` · ${user.suspendedReason}`}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['admin.workers', detail.data.stats.workers],
              ['admin.attendanceRecords', detail.data.stats.attendanceRecords],
              ['admin.payments', detail.data.stats.payments],
              ['admin.totalPaid', formatINR(detail.data.stats.totalPaid)],
              ['admin.pendingDues', formatINR(detail.data.stats.pendingDues)],
              ['admin.advances', formatINR(detail.data.stats.advanceOutstanding)],
            ].map(([key, value]) => (
              <div key={key} className="rounded-control bg-surface-2 p-3">
                <dt className="text-sm text-ink-muted">{t(key)}</dt>
                <dd className="num text-lg font-bold">{value}</dd>
              </div>
            ))}
          </dl>
          <section>
            <h3 className="font-semibold">{t('admin.sites')}</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {detail.data.sites.length === 0 && (
                <li className="text-ink-muted">{t('admin.none')}</li>
              )}
              {detail.data.sites.map((s) => (
                <li key={s._id}>
                  {s.name}
                  {!s.isActive && <span className="text-ink-muted"> · {t('common.inactive')}</span>}
                </li>
              ))}
            </ul>
          </section>
          {user.role === 'contractor' && (
            <section>
              <h3 className="font-semibold">{t('admin.workers')}</h3>
              <p className="text-sm text-ink-muted">{t('admin.maskedNote')}</p>
              {workers.isPending && <SkeletonRows n={4} className="h-12" />}
              {workers.data && (
                <>
                  <ul className="mt-2 divide-y divide-border rounded-control border border-border">
                    {workers.data.data.map((w) => (
                      <li
                        key={w._id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{w.name}</span>
                          <span className="flex flex-wrap gap-x-1.5 text-ink-muted">
                            <span>{t(`roles.${w.role}`)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="num">{w.phone ?? '—'}</span>
                            {w.upiId && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{w.upiId}</span>
                              </>
                            )}
                          </span>
                        </span>
                        <Money paise={w.balance} tone="auto" className="font-semibold" />
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    page={workers.data.page}
                    pages={workers.data.pages}
                    onChange={setPage}
                  />
                </>
              )}
            </section>
          )}
          {user.role === 'contractor' && (
            <div className="border-t border-border pt-4">
              {user.isDemo ? (
                <p className="text-sm text-ink-muted">{t('admin.demoNotSuspendable')}</p>
              ) : user.status === 'active' ? (
                <Button variant="danger" onClick={() => setSuspending(true)}>
                  {t('admin.suspendContractor')}
                </Button>
              ) : (
                <Button onClick={reactivate} loading={setStatus.isPending}>
                  {t('admin.reactivate')}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {suspending && user && <SuspendDialog user={user} onClose={() => setSuspending(false)} />}
    </Modal>
  );
}
