const token = (name) => `hsl(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        'surface-2': token('surface-2'),
        border: token('border'),
        'control-border': token('control-border'),
        ink: token('ink'),
        'ink-muted': token('ink-muted'),
        brand: token('brand'),
        'brand-ink': token('brand-ink'),
        'brand-soft': token('brand-soft'),
        present: token('present'),
        'present-soft': token('present-soft'),
        absent: token('absent'),
        'absent-soft': token('absent-soft'),
        half: token('half'),
        'half-soft': token('half-soft'),
        focus: token('focus'),
      },
      fontFamily: {
        sans: [
          '"Inter Variable"',
          '"Noto Sans Devanagari Variable"',
          'Inter',
          'system-ui',
          '"Noto Sans Devanagari"',
          'sans-serif',
        ],
      },
      borderRadius: { card: '1rem', control: '0.75rem' },
      boxShadow: {
        card: '0 1px 0 hsl(var(--border)), 0 8px 24px -16px hsl(var(--ink) / 0.25)',
        lift: '0 12px 32px -12px hsl(var(--ink) / 0.35)',
      },
      fontSize: {
        display: ['2.75rem', { lineHeight: '1.05', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
    },
  },
  plugins: [],
};
