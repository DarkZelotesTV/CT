import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isScreenshot = env.VITE_SCREENSHOT === 'true';
  const electronPlugins = isScreenshot
    ? []
    : [
        electron([
          {
            // Main Process Config
            entry: 'electron/main.ts',
            onstart(options) {
              options.startup();
            },
            vite: {
              build: {
                sourcemap: true,
                minify: false,
                outDir: 'dist-electron',
                rollupOptions: {
                  // WICHTIG: Hier sagen wir Vite, dass es SQLite ignorieren soll
                  external: ['better-sqlite3'],
                  output: {
                    format: 'cjs',
                    entryFileNames: '[name].cjs',
                  },
                },
              },
            },
          },
          {
            // Preload Script Config
            entry: 'electron/preload.ts',
            onstart(options) {
              options.reload();
            },
            vite: {
              build: {
                sourcemap: true,
                minify: false,
                outDir: 'dist-electron',
                rollupOptions: {
                  output: {
                    format: 'cjs',
                    entryFileNames: '[name].cjs',
                  },
                },
              },
            },
          },
        ]),
        renderer({
          resolve: {
            react: { type: 'esm' },
            'react-dom': { type: 'esm' },
          },
        }),
      ];

  return {
    resolve: {
      dedupe: ['react', 'react-dom'],
    },
    plugins: [react(), ...electronPlugins],
  };
});
