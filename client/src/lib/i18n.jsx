import { createContext, useCallback, useContext, useMemo } from 'react';
import { en } from './en.js';

const DICTIONARIES = { en };
const I18nContext = createContext({ lang: 'en', dict: en });
const warned = new Set();

const lookup = (dict, key) =>
  key.split('.').reduce((node, part) => (node == null ? undefined : node[part]), dict);

export function translate(dict, key, vars) {
  const template = lookup(dict, key) ?? lookup(en, key);
  if (typeof template !== 'string') {
    if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`Missing translation: ${key}`);
    }
    return key;
  }
  return vars
    ? template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`))
    : template;
}

export function I18nProvider({ lang = 'en', children }) {
  const value = useMemo(() => ({ lang, dict: DICTIONARIES[lang] ?? en }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { dict } = useContext(I18nContext);
  return useCallback((key, vars) => translate(dict, key, vars), [dict]);
}

export const useLang = () => useContext(I18nContext).lang;
