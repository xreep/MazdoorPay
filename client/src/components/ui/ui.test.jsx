import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../lib/i18n.jsx';
import { StatusBadge } from './StatusBadge.jsx';
import { Modal } from './Modal.jsx';
import { ConfirmDialog } from './ConfirmDialog.jsx';
import { MoneyInput } from './MoneyInput.jsx';
import { Pagination } from './Pagination.jsx';
import { Money } from './Money.jsx';

const wrap = (ui) => render(<I18nProvider lang="en">{ui}</I18nProvider>);

describe('StatusBadge', () => {
  it.each([
    ['present', 'Present'],
    ['absent', 'Absent'],
    ['half-day', 'Half-day'],
    [null, 'Not marked'],
  ])('%s shows a word and an icon', (status, word) => {
    const { container } = wrap(<StatusBadge status={status} />);
    expect(screen.getByText(word)).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('Modal', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open it</button>
        <Modal open={open} onClose={() => setOpen(false)} title="Edit site">
          <input aria-label="Site name" />
        </Modal>
      </>
    );
  }

  it('closes on Escape and returns focus to the opener', async () => {
    wrap(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    await userEvent.click(opener);
    expect(await screen.findByRole('dialog', { name: 'Edit site' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Site name')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('only confirms through the confirm button', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    wrap(
      <ConfirmDialog
        open
        title="Delete site?"
        body="This cannot be undone."
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('MoneyInput', () => {
  it('reports paise for valid rupees and null with a message for garbage (Review Focus 4)', async () => {
    const onChange = vi.fn();
    wrap(<MoneyInput aria-label="Amount" value={null} onChange={onChange} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, 'abc');
    await userEvent.tab();
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText('Enter an amount in rupees, like 450 or 450.50')).toBeInTheDocument();
    await userEvent.clear(input);
    await userEvent.type(input, '450.5');
    expect(onChange).toHaveBeenLastCalledWith(45050);
  });

  it('shows an incoming value in rupees', () => {
    wrap(<MoneyInput aria-label="Amount" value={123450} onChange={() => {}} />);
    expect(screen.getByLabelText('Amount')).toHaveValue('1234.5');
  });
});

describe('Pagination', () => {
  it('disables Previous on the first page and moves forward', async () => {
    const onChange = vi.fn();
    wrap(<Pagination page={1} pages={3} onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onChange).toHaveBeenCalledWith(2);
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('hides itself when there is only one page', () => {
    const { container } = wrap(<Pagination page={1} pages={1} onChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('Money', () => {
  it('formats paise in Indian style and labels advances', () => {
    wrap(
      <>
        <Money paise={12345600} />
        <Money paise={-50000} tone="auto" />
      </>
    );
    expect(screen.getByText('₹1,23,456')).toBeInTheDocument();
    expect(screen.getByText('₹500 advance')).toBeInTheDocument();
  });
});
