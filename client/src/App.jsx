import { useT } from './lib/i18n.jsx';

export default function App() {
  const t = useT();
  return <main className="p-6 text-2xl font-semibold">{t('app.name')}</main>;
}
