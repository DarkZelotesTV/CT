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
        // Modernes "Deep Space" Thema
        background: '#050507', 
        glass: {
          100: 'rgba(255, 255, 255, 0.03)',
          200: 'rgba(255, 255, 255, 0.07)',
          300: 'rgba(255, 255, 255, 0.12)',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        primary: {
          DEFAULT: '#6366f1', // Indigo
          glow: 'rgba(99, 102, 241, 0.5)',
        },
        success: '#10b981',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'neon': '0 0 20px rgba(99, 102, 241, 0.4)',
      },
      backgroundImage: {
        'aurora': 'radial-gradient(circle at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(circle at 0% 0%, rgba(16,185,129,0.1) 0%, transparent 30%)',
      }
    },
  },
  plugins: [],
}