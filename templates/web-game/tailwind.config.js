/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: '#FFD700', dark: '#B8960F' },
        gem: { DEFAULT: '#7B68EE', dark: '#5A4FCF' },
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-gold': 'pulse-gold 1.5s ease-in-out infinite',
        'float-up': 'float-up 1s ease-out forwards',
      },
      keyframes: {
        'pulse-gold': {
          '0%, 100%': { boxShadow: '0 0 8px #FFD700' },
          '50%': { boxShadow: '0 0 24px #FFD700, 0 0 48px #FFA500' },
        },
        'float-up': {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-64px)' },
        },
      },
    },
  },
  plugins: [],
}
