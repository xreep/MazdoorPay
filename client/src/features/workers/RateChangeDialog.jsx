import { useState } from 'react';
import { toast } from 'sonner';
import { todayIST } from '@mazdoorpay/shared';
import { useFormat, useT } from '../../lib/i18n.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { MoneyInput } from '../../components/ui/MoneyInput.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useChangeRate } from './useWorkers.js';

const latestFrom = (worker) =>
  worker.rateHistory.reduce(
    (max, r) => (r.effectiveFrom > max ? r.effectiveFrom : max),
    worker.joinedOn
  );

export function RateChangeDialog({ open, worker, onClose }) {
  const t = useT();
  const { formatDay } = useFormat();
  const change = useChangeRate();
  const today = todayIST();
  const [rate, setRate] = useState(worker.dailyRate);
  const [from, setFrom] = useState(today);
  const [error, setError] = useState(null);
  const minFrom = latestFrom(worker);

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (rate == null) return setError(t('errors.amountRequired'));
    try {
      const result = await change.mutateAsync({
        id: worker._id,
        dailyRate: rate,
        effectiveFrom: from,
      });
      toast.success(t('workers.rateUpdated', { n: result.repricedDays }));
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('workers.rateTitle')}
      description={t('workers.rateBody')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="rate-form" loading={change.isPending}>
            {t('workers.saveRate')}
          </Button>
        </>
      }
    >
      <form id="rate-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label={t('workers.newRate')} error={error ?? undefined}>
          <MoneyInput value={rate} onChange={setRate} />
        </Field>
        <Field label={t('workers.effectiveFrom')}>
          <Input
            type="date"
            min={minFrom}
            max={today}
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            required
          />
        </Field>
        <p className="rounded-control bg-half-soft px-3.5 py-3 text-sm text-ink">
          {t('workers.repriceWarning', { day: formatDay(from || today) })}
        </p>
      </form>
    </Modal>
  );
}
