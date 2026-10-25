import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../lib/i18n.jsx';
import { PeriodPicker, periodRange } from './PeriodPicker.jsx';

describe('periodRange', () => {
  it('computes preset ranges from an IST day', () => {
    expect(periodRange('this-week', '2026-10-25')).toEqual({
      from: '2026-10-19',
      to: '2026-10-25',
    });
    expect(periodRange('last-week', '2026-10-25')).toEqual({
      from: '2026-10-12',
      to: '2026-10-18',
    });
    expect(periodRange('this-month', '2026-10-25')).toEqual({
      from: '2026-10-01',
      to: '2026-10-25',
    });
    expect(periodRange('last-month', '2026-10-25')).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(periodRange('last-month', '2026-03-10')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });
});

describe('PeriodPicker', () => {
  it('shows a plain error for a backwards custom range and does not report it', async () => {
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <PeriodPicker
          value={{ preset: 'custom', from: '2026-10-10', to: '2026-10-20' }}
          onChange={onChange}
        />
      </I18nProvider>
    );
    const to = screen.getByLabelText('To');
    await userEvent.clear(to);
    await userEvent.type(to, '2026-10-05');
    expect(screen.getByText('End date must be on or after start date')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ to: '2026-10-05' }));
  });

  it('switching preset reports the computed range', async () => {
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <PeriodPicker
          value={{ preset: 'this-week', from: '2026-10-19', to: '2026-10-25' }}
          onChange={onChange}
          today="2026-10-25"
        />
      </I18nProvider>
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Last week' }));
    expect(onChange).toHaveBeenCalledWith({
      preset: 'last-week',
      from: '2026-10-12',
      to: '2026-10-18',
    });
  });
});
