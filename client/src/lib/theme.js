import { useSyncExternalStore } from 'react';

// Light or dark. public/theme.js applies the saved (or system) theme before the first paint;
// this keeps every toggle in sync afterwards and remembers the reader's choice on this device.
const STORAGE_KEY = 'mp-theme';
const THEME_COLOR = { light: '#1C2430', dark: '#12161D' };
const listeners = new Set();

const isDark = () => document.documentElement.classList.contains('dark');

function saved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked: follow the system
  }
}

function apply(dark) {
  document.documentElement.classList.toggle('dark', dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? THEME_COLOR.dark : THEME_COLOR.light);
  listeners.forEach((l) => l());
}

export function setDarkMode(dark) {
  apply(dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  } catch {
    // Not remembered on this device; it still applies now.
  }
}

// Until the reader picks a theme, follow the phone's or computer's setting as it changes.
export function followSystemTheme(query) {
  const onChange = (event) => {
    if (!saved()) apply(event.matches);
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export const useDarkMode = () =>
  useSyncExternalStore((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, isDark);
