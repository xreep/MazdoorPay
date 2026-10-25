import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, onSessionExpired, refreshSession, setAccessToken } from '../lib/api.js';

export const AuthContext = createContext(null);

export const homeFor = (user) => (user?.role === 'admin' ? '/admin' : '/');

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    let alive = true;
    refreshSession().then((session) => {
      if (alive)
        setState(
          session
            ? { status: 'authenticated', user: session.user }
            : { status: 'anonymous', user: null }
        );
    });
    const off = onSessionExpired(() => {
      setAccessToken(null);
      queryClient.clear();
      setState({ status: 'anonymous', user: null });
    });
    return () => {
      alive = false;
      off();
    };
  }, [queryClient]);

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
      register: async (input) => startSession(await api.post('/auth/register', input)),
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
    }),
    [state, startSession, queryClient]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
