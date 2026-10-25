import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { siteCreateSchema } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { applyServerErrors } from '../../lib/forms.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useCreateSite, useUpdateSite } from './useSites.js';

export function SiteForm({ open, site, onClose }) {
  const t = useT();
  const create = useCreateSite();
  const update = useUpdateSite();
  const editing = Boolean(site);
  const { register, handleSubmit, formState, setError, reset } = useForm({
    resolver: zodResolver(siteCreateSchema),
    values: { name: site?.name ?? '', location: site?.location ?? '' },
  });

  const close = () => {
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) await update.mutateAsync({ id: site._id, ...values });
      else await create.mutateAsync(values);
      toast.success(editing ? t('sites.updated') : t('sites.added'));
      close();
    } catch (err) {
      if (!applyServerErrors(err, setError, ['name', 'location'])) toast.error(err.message);
    }
  });

  const title = editing ? t('sites.editTitle') : t('sites.addTitle');
  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="site-form" loading={formState.isSubmitting}>
            {editing ? t('common.saveChanges') : t('sites.addTitle')}
          </Button>
        </>
      }
    >
      <form id="site-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <Field
          label={t('sites.name')}
          hint={t('sites.nameHint')}
          error={formState.errors.name?.message}
        >
          <Input autoComplete="off" {...register('name')} />
        </Field>
        <Field label={t('sites.location')} error={formState.errors.location?.message}>
          <Input autoComplete="off" {...register('location')} />
        </Field>
      </form>
    </Modal>
  );
}
