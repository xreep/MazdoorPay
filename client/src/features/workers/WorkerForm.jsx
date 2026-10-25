import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { WORKER_ROLES, todayIST, workerCreateSchema, workerUpdateSchema } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { applyServerErrors } from '../../lib/forms.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { MoneyField } from '../../components/ui/MoneyInput.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useSiteOptions } from '../sites/useSites.js';
import { useCreateWorker, useUpdateWorker } from './useWorkers.js';

const FIELDS = [
  'name',
  'role',
  'dailyRate',
  'siteId',
  'phone',
  'upiId',
  'preferredLanguage',
  'joinedOn',
];

export function WorkerForm({ open, worker, defaultSiteId, onClose, onSaved }) {
  const t = useT();
  const editing = Boolean(worker);
  const { options: siteOptions } = useSiteOptions();
  const create = useCreateWorker();
  const update = useUpdateWorker();
  const { register, control, handleSubmit, formState, setError, reset } = useForm({
    resolver: zodResolver(editing ? workerUpdateSchema : workerCreateSchema),
    values: {
      name: worker?.name ?? '',
      role: worker?.role ?? 'labourer',
      dailyRate: null,
      siteId: worker ? (worker.siteId ?? null) : (defaultSiteId ?? null),
      phone: worker?.phone ?? '',
      upiId: worker?.upiId ?? '',
      preferredLanguage: worker?.preferredLanguage ?? 'hi',
      joinedOn: worker?.joinedOn ?? todayIST(),
    },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = editing
        ? await update.mutateAsync({ id: worker._id, ...values })
        : await create.mutateAsync(values);
      toast.success(editing ? t('workers.updated') : t('workers.added', { name: saved.name }));
      onSaved?.(saved);
      close();
    } catch (err) {
      if (!applyServerErrors(err, setError, FIELDS)) toast.error(err.message);
    }
  });

  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={close}
      title={editing ? t('workers.editTitle') : t('workers.addTitle')}
      variant="wide"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="worker-form" loading={formState.isSubmitting}>
            {editing ? t('common.saveChanges') : t('workers.addTitle')}
          </Button>
        </>
      }
    >
      <form id="worker-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label={t('workers.name')} error={e.name?.message} className="sm:col-span-2">
          <Input autoComplete="off" {...register('name')} />
        </Field>
        <Field label={t('workers.role')} error={e.role?.message}>
          <Select
            options={WORKER_ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            {...register('role')}
          />
        </Field>
        {!editing && (
          <Field
            label={t('workers.dailyRate')}
            hint={t('workers.dailyRateHint')}
            error={e.dailyRate?.message}
          >
            <MoneyField name="dailyRate" control={control} />
          </Field>
        )}
        <Field label={t('workers.site')} error={e.siteId?.message}>
          <Select
            placeholder={t('workers.noSite')}
            options={siteOptions}
            {...register('siteId', { setValueAs: (v) => v || null })}
          />
        </Field>
        <Field
          label={t('workers.joinedOn')}
          hint={editing ? t('workers.joinedOnEditHint') : undefined}
          error={e.joinedOn?.message}
        >
          <Input
            type="date"
            max={todayIST()}
            {...register('joinedOn', { setValueAs: (v) => v || undefined })}
          />
        </Field>
        <Field label={t('workers.phone')} error={e.phone?.message}>
          <Input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            autoComplete="off"
            {...register('phone')}
          />
        </Field>
        <Field label={t('workers.upiId')} hint={t('workers.upiHint')} error={e.upiId?.message}>
          <Input
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            {...register('upiId')}
          />
        </Field>
        <Field
          label={t('workers.language')}
          hint={t('workers.languageHint')}
          error={e.preferredLanguage?.message}
        >
          <Select
            options={[
              { value: 'hi', label: 'हिन्दी (Hindi)' },
              { value: 'en', label: 'English' },
            ]}
            {...register('preferredLanguage')}
          />
        </Field>
      </form>
    </Modal>
  );
}
