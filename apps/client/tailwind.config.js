/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
theme: {
    extend: {
// In deiner tailwind.config.js unter theme.extend.colors
colors: {
  command: {
    base: '#030304',    // Fast schwarz, sehr tief
    surface: '#09090b', // Sekundärer Hintergrund
    panel: '#121215',   // Panels/Karten
    border: '#27272a',  // Subtile Ränder (Zinc-800)
    accent: '#06b6d4',  // Cyan-500 (Edler als reines Cyan)
    accentGlow: 'rgba(6, 182, 212, 0.15)', // Schein
    text: '#e4e4e7',    // Zinc-200 (Besser lesbar als reines Weiß)
    muted: '#a1a1aa',   // Zinc-400
  }
},
      fontFamily: {
        hud: ['"Share Tech Mono"', 'monospace'], // Empfohlene Schriftart (Google Fonts)
      },
    },
  },
  plugins: [],
}