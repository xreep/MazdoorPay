import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from './i18n.jsx';
import { followSystemTheme } from './theme.js';
import { ThemeToggle } from '../components/layout/ThemeToggle.jsx';

// A stand-in for matchMedia('(prefers-color-scheme: dark)') whose answer the test can change.
function fakeSystem(matches) {
  const listeners = new Set();
  return {
    matches,
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
    change(next) {
      this.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
  };
}

const isDark = () => document.documentElement.classList.contains('dark');
const renderToggles = () =>
  render(
    <I18nProvider lang="en">
      <ThemeToggle />
      <ThemeToggle compact />
    </I18nProvider>
  );

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('dark mode', () => {
  it('the toggle switches every toggle and the page, and is remembered', async () => {
    renderToggles();
    const [first, second] = screen.getAllByRole('button', { name: 'Dark mode' });
    expect(first).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(first);
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('mp-theme')).toBe('dark');
    expect(second).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(second);
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('mp-theme')).toBe('light');
    expect(first).toHaveAttribute('aria-pressed', 'false');
  });

  it("follows the phone's setting until the reader picks a theme", async () => {
    const system = fakeSystem(false);
    const stop = followSystemTheme(system);
    renderToggles();
    act(() => system.change(true));
    expect(isDark()).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Dark mode' })[0]).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await userEvent.click(screen.getAllByRole('button', { name: 'Dark mode' })[0]);
    expect(isDark()).toBe(false);
    act(() => system.change(true));
    expect(isDark()).toBe(false); // the reader's choice wins
    stop();
  });
});
