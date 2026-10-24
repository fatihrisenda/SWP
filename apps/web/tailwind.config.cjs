/** Token desain SWP (Issue 035) — dipindahkan dari app.css hybrid lama. */
const colors = {
  primary: '#2563EB',
  'primary-dark': '#1D4ED8',
  'primary-light': '#DBEAFE',
  'primary-xl': '#EFF6FF',
  bg: '#F4F7FC',
  ink: '#0F172A',
  muted: '#4B5563',
  line: '#E2E8F0',
  top: '#B91C1C',
  high: '#DC2626',
  medium: '#EAB308',
  low: '#16A34A',
  ok: '#16A34A',
  warn: '#D97706',
  danger: '#DC2626',
};

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors,
      borderRadius: { DEFAULT: '14px', card: '14px', pill: '9999px' },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.06), 0 4px 16px rgba(15,23,42,0.06)',
        raised: '0 8px 28px rgba(15,23,42,0.16)',
      },
      fontSize: {
        badge: ['12px', { lineHeight: '16px' }],
        label: ['14px', { lineHeight: '20px' }],
        body: ['15px', { lineHeight: '22px' }],
        base: ['16px', { lineHeight: '24px' }],
        h2: ['18px', { lineHeight: '26px' }],
        h1: ['22px', { lineHeight: '28px' }],
      },
      spacing: {
        nav: '64px',
        safe: 'env(safe-area-inset-bottom, 0px)',
      },
      minHeight: { touch: '44px' },
      maxWidth: { content: '1100px' },
    },
  },
  plugins: [],
};
