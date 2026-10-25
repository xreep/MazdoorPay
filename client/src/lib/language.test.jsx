import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { API, HttpResponse, http, server } from '../test/server.js';
import { AuthProvider } from '../auth/AuthProvider.jsx';
import { LanguageToggle } from '../components/layout/LanguageToggle.jsx';
import { en } from './en.js';
import { hi } from './hi.js';
import { I18nProvider, useFormat, useT } from './i18n.jsx';

// Every key path with its {placeholders}, e.g. "workers.count" → ["n"].
function shape(dict, prefix = '') {
  return Object.entries(dict).flatMap(([key, value]) =>
    typeof value === 'string'
      ? [[`${prefix}${key}`, [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()]]
      : shape(value, `${prefix}${key}.`)
  );
}

function Probe() {
  const t = useT();
  const { formatMonth } = useFormat();
  return (
    <p>
      {t('nav.home')} · {formatMonth('2026-10')}
    </p>
  );
}

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = 'en';
});

describe('Hindi', () => {
  it('has every English text, with the same placeholders', () => {
    expect(Object.fromEntries(shape(hi))).toEqual(Object.fromEntries(shape(en)));
  });

  it('the switch changes the whole interface, dates included, and is remembered', async () => {
    render(
      <I18nProvider>
        <Probe />
        <LanguageToggle />
      </I18nProvider>
    );
    expect(screen.getByText('Home · October 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'हिन्दी में देखें' }));
    expect(screen.getByText('होम · अक्टूबर 2026')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('hi');
    expect(localStorage.getItem('mp-lang')).toBe('hi');
    expect(screen.getByRole('button', { name: 'English में देखें' })).toBeInTheDocument();
  });

  it("uses the signed-in account's language, and saves a change to the account", async () => {
    const patches = [];
    const user = { _id: 'c1', name: 'Ravi Kumar', role: 'contractor', preferredLanguage: 'hi' };
    server.use(
      http.post(API('/auth/refresh'), () => HttpResponse.json({ accessToken: 'token', user })),
      http.patch(API('/auth/me'), async ({ request }) => {
        const body = await request.json();
        patches.push(body);
        return HttpResponse.json({ user: { ...user, ...body } });
      })
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <I18nProvider>
          <AuthProvider>
            <Probe />
            <LanguageToggle />
          </AuthProvider>
        </I18nProvider>
      </QueryClientProvider>
    );
    expect(await screen.findByText('होम · अक्टूबर 2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'English में देखें' }));
    expect(screen.getByText('Home · October 2026')).toBeInTheDocument();
    await waitFor(() => expect(patches).toEqual([{ preferredLanguage: 'en' }]));
    // The account's answer must not flip the screen back.
    expect(screen.getByText('Home · October 2026')).toBeInTheDocument();
  });
});
