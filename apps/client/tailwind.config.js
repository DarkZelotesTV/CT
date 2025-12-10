/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'], // Für technische Details (IDs, Ping)
      },
      colors: {
        // TeamSpeak 5 Inspired Palette (Kühl, Technisch, Deep)
        ts: {
          base: '#09090b',      // Fast schwarz (Hintergrund Main)
          surface: '#121317',   // Sidebar Hintergrund
          panel: '#1a1b21',     // Karten / Modals
          hover: '#272832',     // Hover State
          border: '#2e303e',    // Subtile Ränder
          accent: '#3b82f6',    // TS Blue (Primary)
          accentHover: '#2563eb',
          voice: '#10b981',     // TS Voice Activation Green
        }
      },
      backgroundImage: {
        'gradient-ts': 'linear-gradient(to bottom right, #121317, #09090b)',
        'gradient-glow': 'radial-gradient(circle at center, rgba(59, 130, 246, 0.15), transparent 70%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.15)',
        'panel': '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'in': 'animate-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'animate-in': {
          '0%': { opacity: 0, transform: 'translateY(5px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      }
    },
  },
  plugins: [],
}