import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { HandCoins } from 'lucide-react';
import { formatINR, paymentCreateSchema, todayIST } from '@mazdoorpay/shared';
import { useT } from '../../lib/i18n.jsx';
import { applyServerErrors } from '../../lib/forms.js';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Field.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { MoneyField } from '../../components/ui/MoneyInput.jsx';
import { SelectField } from '../../components/ui/Select.jsx';
import { SegmentedControl } from '../../components/ui/SegmentedControl.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useWorkerSummary, useWorkers } from '../workers/useWorkers.js';
import { refreshAfterSave } from '../../lib/query.js';
import { useRecordPayment } from './usePayments.js';
import { UpiPayAssist } from './UpiPayAssist.jsx';

const FIELDS = ['workerId', 'amount', 'type', 'method', 'reference', 'notes', 'day'];

// Mount this only while open: each opening gets its own request key, so a double tap
// (or a retry after a network blip) can never record the same payment twice.
export function RecordPaymentModal({ open, workerId: initialWorkerId, onClose }) {
  const t = useT();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [workerId, setWorkerId] = useState(initialWorkerId ?? '');
  const [overDues, setOverDues] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [maybeSaved, setMaybeSaved] = useState(false);
  const queryClient = useQueryClient();
  const inFlight = useRef(false);
  const record = useRecordPayment();
  const { data: workersPage, isPending: workersLoading } = useWorkers({
    status: 'active',
    limit: 100,
  });
  const { data: summary } = useWorkerSummary(workerId || undefined);

  const { register, control, handleSubmit, formState, setValue, setError, watch } = useForm({
    resolver: zodResolver(paymentCreateSchema),
    defaultValues: {
      workerId,
      amount: null,
      type: 'wage',
      method: 'cash',
      reference: '',
      notes: '',
      day: todayIST(),
      idempotencyKey,
    },
  });
  const method = watch('method');
  const type = watch('type');
  const amount = watch('amount');
  const balance = summary?.balance.balance ?? null;
  const due = balance == null ? null : Math.max(balance, 0);

  // Pre-fill the amount with what the chosen worker is owed.
  const summaryWorker = summary?.worker._id;
  useEffect(() => {
    if (!summaryWorker) return;
    setValue('amount', due > 0 ? due : null, { shouldValidate: false });
  }, [summaryWorker, due, setValue]);

  const workerOptions = (workersPage?.data ?? []).map((w) => ({ value: w._id, label: w.name }));
  if (summary && !workerOptions.some((o) => o.value === summary.worker._id))
    workerOptions.unshift({ value: summary.worker._id, label: summary.worker.name });

  const onSubmit = handleSubmit(async (values) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setServerError(null);
    setOverDues(null);
    try {
      const result = await record.mutateAsync(values);
      toast.success(t('payments.saved'), {
        action: {
          label: t('payments.printReceipt'),
          onClick: () => window.open(`/print/receipt/${result.payment._id}`, '_blank'),
        },
      });
      // Stay locked: the form is closing, and a late second tap must not send again.
      onClose();
    } catch (err) {
      inFlight.current = false;
      // No answer (network) or "key already used" (a retry after a lost answer): the first try may have been saved.
      if (err.status === 0 || err.status === 409) {
        setMaybeSaved(true);
        refreshAfterSave(queryClient, ['payments', 'dues', 'wages', 'dashboard', 'worker']);
        return;
      }
      const aboveDues =
        err.status === 400 && values.type === 'wage' && err.details?.[0]?.path === 'amount';
      if (aboveDues) setOverDues({ message: err.message, amount: values.amount });
      else if (!applyServerErrors(err, setError, FIELDS)) setServerError(err.message);
    }
  });

  const e = formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payments.recordTitle')}
      variant="wide"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="payment-form" loading={formState.isSubmitting}>
            <HandCoins className="h-5 w-5" aria-hidden="true" />
            {t('payments.save')}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label={t('payments.worker')} error={e.workerId?.message} className="sm:col-span-2">
          <SelectField
            name="workerId"
            control={control}
            placeholder={workersLoading ? t('payments.loadingWorkers') : t('payments.chooseWorker')}
            options={workerOptions}
            onValueChange={setWorkerId}
          />
        </Field>

        {summary && (
          <p
            className={`num rounded-control px-3.5 py-3 text-sm font-semibold sm:col-span-2 ${due > 0 ? 'bg-present-soft text-present' : 'bg-surface-2 text-ink-muted'}`}
          >
            {due > 0
              ? t('payments.pending', { amount: formatINR(due) })
              : t('payments.nothingPending')}
            {balance < 0 && (
              <span className="font-normal">
                {' '}
                · {t('payments.advanceHeld', { amount: formatINR(-balance) })}
              </span>
            )}
          </p>
        )}

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{t('payments.typeLabel')}</span>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <SegmentedControl
                label={t('payments.typeLabel')}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setOverDues(null);
                }}
                options={[
                  { value: 'wage', label: t('payments.type.wage') },
                  { value: 'advance', label: t('payments.type.advance') },
                ]}
              />
            )}
          />
          <p className="text-sm text-ink-muted">
            {type === 'wage' ? t('payments.wageHint') : t('payments.advanceHint')}
          </p>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{t('payments.methodLabel')}</span>
          <Controller
            name="method"
            control={control}
            render={({ field }) => (
              <SegmentedControl
                label={t('payments.methodLabel')}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  if (v === 'cash') setValue('reference', '');
                }}
                options={[
                  { value: 'cash', label: t('payments.method.cash') },
                  { value: 'upi', label: t('payments.method.upi') },
                  { value: 'bank', label: t('payments.method.bank') },
                ]}
              />
            )}
          />
        </div>

        {/* The amount box shows its own single message. */}
        <Field label={t('payments.amount')}>
          <MoneyField name="amount" control={control} />
        </Field>

        <Field label={t('payments.date')} error={e.day?.message}>
          <Input type="date" max={todayIST()} {...register('day')} />
        </Field>

        {method === 'upi' && summary && (
          <UpiPayAssist worker={summary.worker} amount={amount} type={type} />
        )}

        {method !== 'cash' && (
          <Field
            label={method === 'upi' ? t('payments.utr') : t('payments.bankRef')}
            hint={method === 'upi' ? t('payments.utrHint') : undefined}
            error={e.reference?.message}
          >
            <Input
              inputMode={method === 'upi' ? 'numeric' : 'text'}
              autoComplete="off"
              maxLength={30}
              {...register('reference')}
            />
          </Field>
        )}

        <Field
          label={t('payments.notes')}
          error={e.notes?.message}
          className={method === 'cash' ? 'sm:col-span-2' : ''}
        >
          <Input autoComplete="off" maxLength={500} {...register('notes')} />
        </Field>

        {overDues && (
          <div role="alert" className="space-y-3 rounded-control bg-half-soft p-4 sm:col-span-2">
            <p className="font-medium text-ink">{overDues.message}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setValue('type', 'advance');
                setOverDues(null);
              }}
            >
              {t('payments.switchToAdvance', { amount: formatINR(overDues.amount) })}
            </Button>
          </div>
        )}
        {maybeSaved && (
          <div role="alert" className="space-y-2 rounded-control bg-half-soft p-4 sm:col-span-2">
            <p className="font-medium text-ink">{t('payments.maybeSaved')}</p>
            <Link
              to={`/payments?tab=history&workerId=${workerId}`}
              className="inline-flex h-12 items-center font-semibold text-brand-ink underline"
            >
              {t('payments.checkHistory')}
            </Link>
          </div>
        )}
        {serverError && (
          <p
            role="alert"
            className="rounded-control bg-absent-soft px-3.5 py-3 text-sm font-medium text-absent sm:col-span-2"
          >
            {serverError}
          </p>
        )}
      </form>
    </Modal>
  );
}
