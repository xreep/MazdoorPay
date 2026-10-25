import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useT } from './i18n.jsx';

function Probe({ k, vars }) {
  const t = useT();
  return <span>{t(k, vars)}</span>;
}

describe('i18n', () => {
  it('interpolates variables', () => {
    render(
      <I18nProvider lang="en">
        <Probe k="workers.count" vars={{ n: 3 }} />
      </I18nProvider>
    );
    expect(screen.getByText('3 workers')).toBeInTheDocument();
  });

  it('falls back to the key when missing', () => {
    render(
      <I18nProvider lang="en">
        <Probe k="nope.missing" />
      </I18nProvider>
    );
    expect(screen.getByText('nope.missing')).toBeInTheDocument();
  });
});
