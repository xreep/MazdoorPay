import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell.jsx';
import { setUnsavedCount } from '../../lib/unsaved.js';
import { admin, renderWithProviders } from '../../test/render.jsx';

describe('AppShell', () => {
  it('shows contractor navigation for a contractor', () => {
    renderWithProviders(<AppShell />);
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'Attendance', 'Workers', 'Payments', 'Wages', 'Sites']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole('link', { name: 'Users' })).toBeNull();
  });

  it('shows admin navigation for an admin', () => {
    renderWithProviders(<AppShell />, { user: admin, route: '/admin', path: '/admin' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Overview', 'Users', 'Activity', 'Data checks', 'Analytics']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument();
    }
    expect(within(nav).queryByRole('link', { name: 'Workers' })).toBeNull();
  });

  it('the mobile More sheet has the remaining pages and Log out', async () => {
    const { auth } = renderWithProviders(<AppShell />);
    const tabs = screen.getByRole('navigation', { name: 'Quick' });
    await userEvent.click(within(tabs).getByRole('button', { name: 'More' }));
    const sheet = await screen.findByRole('dialog', { name: 'More' });
    expect(within(sheet).getByRole('link', { name: 'Sites' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalled();
  });

  it('asks before logging out when there are unsaved attendance marks', async () => {
    setUnsavedCount(2);
    const { auth } = renderWithProviders(<AppShell />);
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Quick' })).getByRole('button', {
        name: 'More',
      })
    );
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: 'More' })).getByRole('button', {
        name: 'Log out',
      })
    );
    const confirm = await screen.findByRole('dialog', {
      name: 'Log out and lose 2 unsaved changes?',
    });
    expect(auth.logout).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalled();
    setUnsavedCount(0);
  });
});
