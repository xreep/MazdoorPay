import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Reads the light and dark theme tokens from index.css and checks WCAG 2.1 contrast for the pairs
// the UI uses, in both themes.
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
// The rule whose selector list starts with `selector`, e.g. ":root, .theme-light { … }".
const block = (selector) => {
  const start = css.search(new RegExp(`^${selector.replace('.', '\\.')}[\\s,{]`, 'm'));
  if (start < 0) throw new Error(`no ${selector} rule`);
  return css.slice(start, css.indexOf('}', start));
};
const THEMES = { light: block(':root'), dark: block('.dark') };
const token = (theme, name) => {
  const m = THEMES[theme].match(new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`));
  if (!m) throw new Error(`${theme} token ${name} missing`);
  return m.slice(1).map(Number);
};

const hslToRgb = ([h, s, l]) => {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
};
const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const rgb = (theme, name) => hslToRgb(token(theme, name));

describe.each(['light', 'dark'])('colour contrast in the %s theme (WCAG AA)', (theme) => {
  it.each([
    ['present', 'present-soft'],
    ['half', 'half-soft'],
    ['absent', 'absent-soft'],
    ['half', 'surface'],
    ['present', 'surface'],
    ['absent', 'surface'],
    ['on-brand', 'brand'],
    ['brand-ink', 'surface'],
    ['brand-ink', 'brand-soft'],
    ['ink-muted', 'surface'],
    ['ink-muted', 'bg'],
    ['ink', 'bg'],
    ['ink', 'surface'],
    ['on-ink', 'ink'],
    ['on-solid', 'present'],
    ['on-solid', 'half'],
    ['on-solid', 'absent'],
  ])('%s text on %s is at least 4.5:1', (fg, bg) => {
    expect(ratio(rgb(theme, fg), rgb(theme, bg))).toBeGreaterThanOrEqual(4.5);
  });

  it('form control borders are at least 3:1 against the surface', () => {
    expect(ratio(rgb(theme, 'control-border'), rgb(theme, 'surface'))).toBeGreaterThanOrEqual(3);
  });
});
