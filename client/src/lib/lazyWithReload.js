import { lazy } from 'react';

// Each deploy replaces every page's code file. A tab opened before the deploy still asks for the
// old file, which is gone (404), and the page would show the error screen until reloaded. So the
// first time that happens, reload to pick up the new deploy. If the file is still missing right
// after reloading, the error screen shows as usual, so there is never a reload loop.
const KEY = 'mp-reloaded-for-new-version';
const RETRY_AFTER_MS = 60_000;

export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(KEY));
    if (last && Date.now() - last < RETRY_AFTER_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // storage blocked: cannot guard against a loop, so do not reload
  }
  window.location.reload();
  return true;
}

// React.lazy that recovers from a deploy instead of showing the error screen.
export const lazyWithReload = (load) =>
  lazy(() =>
    load().catch((err) => {
      // While the page reloads, stay on the loading state.
      if (reloadForNewVersion()) return new Promise(() => {});
      throw err;
    })
  );
