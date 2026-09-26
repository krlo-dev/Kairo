import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kairo: {
          amber: '#BA7517',
          amberLight: '#EF9F27',
          amberDark: '#633806',
          gold: '#FAC775',
          cream: '#FAEEDA',
          paper: '#FDFAF5',
          navy: '#1a1a2e',
          navyDeep: '#0f0f1a',
          surfaceDark: '#1a1a2e',
          borderDark: '#2d2d3d',
        },
        semantic: {
          up: '#dc2626',
          down: '#16a34a',
          info: '#2563eb',
          alert: '#BA7517',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'kairo-h1': ['36px', { lineHeight: '1.2', fontWeight: '500' }],
        'kairo-h2': ['28px', { lineHeight: '1.3', fontWeight: '500' }],
        'kairo-h3': ['22px', { lineHeight: '1.4', fontWeight: '500' }],
        'kairo-h4': ['18px', { lineHeight: '1.4', fontWeight: '500' }],
        'kairo-body': ['15px', { lineHeight: '1.7', fontWeight: '400' }],
        'kairo-small': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'kairo-label': ['11px', { lineHeight: '1.5', fontWeight: '500', letterSpacing: '0.06em' }],
        'kairo-price': ['24px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      borderRadius: {
        kairo: '12px',
      },
      transitionDuration: {
        kairo: '150ms',
      },
    },
  },
  plugins: [],
};

export default config;
