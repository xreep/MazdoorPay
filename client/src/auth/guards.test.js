import { describe, expect, it } from 'vitest';
import { safeNext } from './guards.jsx';

describe('safeNext', () => {
  it('allows same-app paths', () => {
    expect(safeNext('/workers?siteId=1')).toBe('/workers?siteId=1');
    expect(safeNext('/admin/users')).toBe('/admin/users');
  });

  it('rejects anything that could leave the app', () => {
    for (const bad of [
      '//evil.com',
      '/\\evil.com',
      '/\t/evil.com',
      '/\n/evil.com',
      'https://evil.com',
      'evil.com',
      '',
      null,
      undefined,
    ]) {
      expect(safeNext(bad)).toBeNull();
    }
  });
});
