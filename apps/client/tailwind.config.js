/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-alt': 'var(--color-surface-alt)',
        'surface-hover': 'var(--color-surface-hover)',
        'surface-2': 'var(--surface-2)',
        'surface-3': 'var(--surface-3)',
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
        },
        overlay: 'var(--state-overlay)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'neon': 'var(--state-accent-glow)',
      },
      backgroundImage: {
        'aurora': 'radial-gradient(circle at 50% 0%, rgb(var(--decor-orb-1-rgb) / var(--decor-orb-1-opacity)) 0%, transparent 50%), radial-gradient(circle at 0% 0%, rgb(var(--decor-orb-2-rgb) / var(--decor-orb-2-opacity)) 0%, transparent 30%)',
      }
    },
  },
  plugins: [],
}
