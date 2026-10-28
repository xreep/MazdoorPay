import { afterEach, describe, expect, it, vi } from 'vitest';
import { reloadForNewVersion } from './lazyWithReload.js';

const reload = vi.fn();
vi.stubGlobal('location', { ...window.location, reload });

afterEach(() => {
  sessionStorage.clear();
  reload.mockClear();
  vi.useRealTimers();
});

describe('reloadForNewVersion', () => {
  it('reloads once to pick up a new deploy, but never twice in a row', () => {
    expect(reloadForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    // Still failing right after reloading: the file really is missing, so show the error.
    expect(reloadForNewVersion()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('can reload again for a later deploy', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
    expect(reloadForNewVersion()).toBe(true);
    vi.setSystemTime(new Date('2026-10-28T10:05:00Z'));
    expect(reloadForNewVersion()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
