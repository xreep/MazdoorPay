import { useState } from 'react';
import { toast } from 'sonner';
import { useT } from '../../lib/i18n.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Money } from '../../components/ui/Money.jsx';
import { useVoidPayment } from './usePayments.js';

export function VoidPaymentDialog({ payment, onClose }) {
  const t = useT();
  const [reason, setReason] = useState('');
  const voidIt = useVoidPayment();
  const valid = reason.trim().length >= 3;
  const submit = async () => {
    try {
      await voidIt.mutateAsync({ id: payment._id, reason: reason.trim() });
      toast.success(t('payments.voided'));
      onClose();
    } catch (err) {
      toast.error(err.message);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={t('payments.voidTitle')}
      description={t('payments.voidBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" disabled={!valid} loading={voidIt.isPending} onClick={submit}>
            {t('payments.voidAction')}
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-control bg-surface-2 px-3.5 py-3">
        <span className="font-semibold">{payment.worker?.name}</span> ·{' '}
        <Money paise={payment.amount} className="font-semibold" />
      </p>
      <Field label={t('attendance.reason')} hint={t('payments.voidHint')}>
        <Input value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
