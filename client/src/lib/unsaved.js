import { useSyncExternalStore } from 'react';

// How many unsaved edits the current screen holds, so app-wide actions (like logging out) can ask first.
let count = 0;
const listeners = new Set();

export function setUnsavedCount(n) {
  if (n === count) return;
  count = n;
  listeners.forEach((l) => l());
}

export const getUnsavedCount = () => count;

export const useUnsavedCount = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => count
  );
