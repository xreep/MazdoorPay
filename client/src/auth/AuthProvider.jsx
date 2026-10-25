import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSessionExpired, refreshSession, setAccessToken } from '../lib/api.js';
import { useLang, useSetLang } from '../lib/i18n.jsx';

export const AuthContext = createContext(null);

export const homeFor = (user) => (user?.role === 'admin' ? '/admin' : '/');

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: 'loading', user: null });
  const lang = useLang();
  const setLang = useSetLang();

  // Signed in, the account's language wins, so it follows the user to every device.
  const accountLang = state.user?.preferredLanguage;
  useEffect(() => {
    if (accountLang) setLang(accountLang);
  }, [accountLang, setLang]);

  const boot = useCallback(() => {
    setState((s) => (s.status === 'error' ? { status: 'loading', user: null } : s));
    return refreshSession().then(
      (session) =>
        session
          ? { status: 'authenticated', user: session.user }
          : { status: 'anonymous', user: null },
      // The server could not be reached: whether there is a session is still unknown.
      () => ({ status: 'error', user: null })
    );
  }, []);

  useEffect(() => {
    let alive = true;
    boot().then((next) => alive && setState(next));
    const off = onSessionExpired(() => {
      setAccessToken(null);
      queryClient.clear();
      setState({ status: 'anonymous', user: null });
    });
    return () => {
      alive = false;
      off();
    };
  }, [queryClient, boot]);

  const startSession = useCallback((data) => {
    setAccessToken(data.accessToken);
    setState({ status: 'authenticated', user: data.user });
    return data.user;
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login: async (email, password) =>
        startSession(await api.post('/auth/login', { email, password })),
      register: async (input) =>
        startSession(await api.post('/auth/register', { ...input, preferredLanguage: lang })),
      setLanguage: async (next) => {
        setLang(next);
        if (!state.user) return;
        setState((s) => ({ ...s, user: { ...s.user, preferredLanguage: next } }));
        try {
          await api.patch('/auth/me', { preferredLanguage: next });
        } catch {
          // Still switched on this device; the account keeps its old language.
        }
      },
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          setAccessToken(null);
          queryClient.clear();
          // A deliberate logout lands on a plain /login, without "come back to" this page.
          setState({ status: 'anonymous', user: null, loggedOut: true });
        }
      },
      updateUser: (user) => setState((s) => ({ ...s, user })),
      retry: () => boot().then(setState),
    }),
    [state, startSession, queryClient, boot, lang, setLang]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
