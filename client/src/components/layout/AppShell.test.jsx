import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from './AppShell.jsx';
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
});
