/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Discord-ähnliche Farbpalette
        dark: {
          100: '#313338', // Haupt-Hintergrund
          200: '#2b2d31', // Seitenleisten
          300: '#1e1f22', // Server-Leiste / Inputs
          400: '#111214', // Tiefstes Schwarz
        },
        primary: '#5865F2', // Discord Blau
      }
    },
  },
  plugins: [],
}