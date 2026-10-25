import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n.jsx';
import { Logo } from '../components/layout/Logo.jsx';

export default function NotFoundPage() {
  const t = useT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div>
        <h1 className="text-display">404</h1>
        <p className="mt-2 text-lg text-ink-muted">{t('notFound.body')}</p>
      </div>
      <Link
        to="/"
        className="flex h-12 items-center rounded-control bg-brand px-5 font-semibold text-ink"
      >
        {t('notFound.home')}
      </Link>
    </main>
  );
}
