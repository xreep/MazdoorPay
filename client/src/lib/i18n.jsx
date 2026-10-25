import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en } from './en.js';
import { hi } from './hi.js';
import { dateFormatters } from './format.js';

const DICTIONARIES = { en, hi };
const STORAGE_KEY = 'mp-lang';
const I18nContext = createContext({ lang: 'en', dict: en, setLang: () => {} });
const warned = new Set();

// The reader's earlier choice on this device, else their browser's language.
function deviceLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (DICTIONARIES[saved]) return saved;
  } catch {
    // Storage blocked (private mode): fall through to the browser's language.
  }
  return navigator.language?.toLowerCase().startsWith('hi') ? 'hi' : 'en';
}

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

// Without `lang`, the reader picks the language and it is remembered on this device.
// With `lang`, it is fixed: a printed slip in the worker's language, or a test.
export function I18nProvider({ lang: fixed, children }) {
  const [chosen, setChosen] = useState(() => (DICTIONARIES[fixed] ? fixed : deviceLanguage()));
  const lang = DICTIONARIES[fixed] ? fixed : chosen;
  const setLang = useCallback((next) => {
    if (!DICTIONARIES[next]) return;
    setChosen(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered on this device; the account still keeps it.
    }
  }, []);
  useEffect(() => {
    if (!fixed) document.documentElement.lang = lang;
  }, [fixed, lang]);
  const value = useMemo(() => ({ lang, dict: DICTIONARIES[lang], setLang }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { dict } = useContext(I18nContext);
  return useCallback((key, vars) => translate(dict, key, vars), [dict]);
}

export const useLang = () => useContext(I18nContext).lang;
export const useSetLang = () => useContext(I18nContext).setLang;

// Date formatters in the current language.
export function useFormat() {
  const { lang } = useContext(I18nContext);
  return useMemo(() => dateFormatters(lang), [lang]);
}
