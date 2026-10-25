import { forwardRef, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check, Eye, EyeOff } from 'lucide-react';
import { loginSchema, registerSchema } from '@mazdoorpay/shared';
import { homeFor, useAuth } from '../auth/AuthProvider.jsx';
import { safeNext } from '../auth/guards.jsx';
import { useT } from '../lib/i18n.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Field } from '../components/ui/Field.jsx';
import { Input } from '../components/ui/Input.jsx';
import { LanguageToggle } from '../components/layout/LanguageToggle.jsx';
import { Logo } from '../components/layout/Logo.jsx';
import { applyServerErrors } from '../lib/forms.js';

const DEMO = [
  { key: 'demoContractor', email: 'ravi.kumar@mazdoorpay.in', password: 'Demo@2026' },
  { key: 'demoContractor2', email: 'sunita.patil@mazdoorpay.in', password: 'Demo@2026' },
  { key: 'demoAdmin', email: 'admin@mazdoorpay.in', password: 'Admin@2026' },
];

const PasswordInput = forwardRef(function PasswordInput(props, ref) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className="pr-12" {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink-muted hover:text-ink"
      >
        {visible ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
});

function AuthForm({ mode, fill }) {
  const t = useT();
  const { login, register: registerUser } = useAuth();
  const isLogin = mode === 'login';
  const [serverError, setServerError] = useState(null);
  const form = useForm({
    resolver: zodResolver(isLogin ? loginSchema : registerSchema),
    defaultValues: isLogin
      ? { email: '', password: '' }
      : { name: '', email: '', password: '', phone: '' },
  });
  const { register, handleSubmit, formState, setError, setValue } = form;

  useEffect(() => {
    if (fill && isLogin) {
      setValue('email', fill.email, { shouldValidate: false });
      setValue('password', fill.password, { shouldValidate: false });
    }
  }, [fill, isLogin, setValue]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (isLogin) await login(values.email, values.password);
      else await registerUser(values);
    } catch (err) {
      if (!applyServerErrors(err, setError, Object.keys(values))) setServerError(err.message);
    }
  });

  const e = formState.errors;
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {!isLogin && (
        <Field label={t('auth.name')} error={e.name?.message}>
          <Input autoComplete="name" {...register('name')} />
        </Field>
      )}
      <Field label={t('auth.email')} error={e.email?.message}>
        <Input type="email" autoComplete="email" inputMode="email" {...register('email')} />
      </Field>
      <Field
        label={t('auth.password')}
        hint={isLogin ? undefined : t('auth.passwordHint')}
        error={e.password?.message}
      >
        <PasswordInput
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          {...register('password')}
        />
      </Field>
      {!isLogin && (
        <Field label={t('auth.phone')} hint={t('auth.phoneHint')} error={e.phone?.message}>
          <Input
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            {...register('phone')}
          />
        </Field>
      )}
      {serverError && (
        <p
          role="alert"
          className="rounded-control bg-absent-soft px-3.5 py-3 text-sm font-medium text-absent"
        >
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={formState.isSubmitting}>
        {isLogin ? t('auth.login') : t('auth.register')}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  const t = useT();
  const { status, user } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [fill, setFill] = useState(null);

  if (status === 'authenticated') {
    const next = safeNext(params.get('next'));
    const home = homeFor(user);
    const allowed = next && (user.role === 'admin') === next.startsWith('/admin');
    return <Navigate to={allowed ? next : home} replace />;
  }

  const tabs = [
    { id: 'login', label: t('auth.loginTab') },
    { id: 'register', label: t('auth.registerTab') },
  ];

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <Logo inverted />
        <div className="max-w-lg pb-16">
          <h1 className="text-display">{t('auth.heroTitle')}</h1>
          <p className="mt-5 text-lg leading-relaxed text-white/75">{t('auth.heroBody')}</p>
          <ul className="mt-10 space-y-4">
            {['heroPoint1', 'heroPoint2', 'heroPoint3'].map((k) => (
              <li key={k} className="flex items-start gap-3 text-white/90">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-ink">
                  <Check className="h-4 w-4" aria-hidden="true" />
                </span>
                {t(`auth.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="hivis-tape absolute inset-x-0 bottom-0 h-5" aria-hidden="true" />
      </aside>

      <main className="relative flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <LanguageToggle className="absolute right-3 top-3" />
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <div className="rounded-card bg-surface p-6 shadow-card sm:p-8">
            <div
              role="tablist"
              aria-label={t('app.name')}
              className="mb-6 grid grid-cols-2 rounded-control bg-surface-2 p-1"
            >
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={mode === tab.id}
                  onClick={() => setMode(tab.id)}
                  className={`h-12 rounded-[0.6rem] text-sm font-semibold transition ${mode === tab.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? t('auth.welcome') : t('auth.newHere')}
            </h2>
            <p className="mb-6 mt-1 text-ink-muted">
              {mode === 'login' ? t('auth.welcomeBody') : t('auth.newHereBody')}
            </p>
            <AuthForm key={mode} mode={mode} fill={fill} />
          </div>

          {mode === 'login' && (
            <section
              className="mt-6 rounded-card border border-dashed border-border p-5"
              aria-labelledby="demo-title"
            >
              <h3 id="demo-title" className="font-semibold">
                {t('auth.demoTitle')}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">{t('auth.demoBody')}</p>
              <ul className="mt-4 space-y-2">
                {DEMO.map((d) => (
                  <li key={d.email} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{t(`auth.${d.key}`)}</p>
                      <p className="truncate text-sm text-ink-muted">{d.email}</p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setFill({ email: d.email, password: d.password })}
                      aria-label={`${t('auth.use')} ${d.email}`}
                    >
                      {t('auth.use')}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
