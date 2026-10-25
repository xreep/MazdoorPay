import { Moon, Sun } from 'lucide-react';
import { useT } from '../../lib/i18n.jsx';
import { setDarkMode, useDarkMode } from '../../lib/theme.js';

// Dark mode on or off. `compact` shows the icon only (phone header, login page).
export function ThemeToggle({ compact = false, className = '' }) {
  const t = useT();
  const dark = useDarkMode();
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      aria-pressed={dark}
      aria-label={compact ? t('common.darkMode') : undefined}
      onClick={() => setDarkMode(!dark)}
      className={`inline-flex h-12 items-center gap-2 rounded-control font-semibold text-ink-muted hover:bg-ink/5 hover:text-ink ${compact ? 'w-12 justify-center' : 'px-3'} ${className}`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {!compact && t('common.darkMode')}
    </button>
  );
}
