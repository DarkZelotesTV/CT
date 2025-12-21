import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(
        __dirname,
        'node_modules/react/jsx-runtime.js',
      ),
      'react/jsx-dev-runtime': path.resolve(
        __dirname,
        'node_modules/react/jsx-dev-runtime.js',
      ),
    },
  },
  plugins: [
    react(),
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
  ],
});
