import { Languages } from 'lucide-react';
import { useLang, useSetLang, useT } from '../../lib/i18n.jsx';
import { useAuth } from '../../auth/AuthProvider.jsx';

const OTHER = { en: { lang: 'hi', label: 'हिन्दी' }, hi: { lang: 'en', label: 'English' } };

// Switches between English and Hindi. Signed in, the choice is also saved to the account.
export function LanguageToggle({ className = '' }) {
  const t = useT();
  const lang = useLang();
  const setLang = useSetLang();
  const auth = useAuth();
  const other = OTHER[lang];
  return (
    <button
      type="button"
      onClick={() => (auth?.setLanguage ?? setLang)(other.lang)}
      aria-label={t('common.switchLanguage')}
      className={`inline-flex h-12 items-center gap-2 rounded-control px-3 font-semibold text-ink-muted hover:bg-ink/5 hover:text-ink ${className}`}
    >
      <Languages className="h-5 w-5" aria-hidden="true" />
      <span lang={other.lang}>{other.label}</span>
    </button>
  );
}
