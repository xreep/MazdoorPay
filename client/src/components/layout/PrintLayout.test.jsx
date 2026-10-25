import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from '../../lib/i18n.jsx';
import { PrintLayout } from './PrintLayout.jsx';

afterEach(() => vi.restoreAllMocks());

describe('PrintLayout', () => {
  it('Back closes a print tab that was opened on its own', async () => {
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);
    render(
      <I18nProvider>
        <PrintLayout title="Receipt">x</PrintLayout>
      </I18nProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(close).toHaveBeenCalled();
  });
});
