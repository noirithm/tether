import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: entry('./sidepanel.html'),
        background: entry('./src/background.ts'),
      },
      output: {
        // the manifest refers to the background script by name
        entryFileNames: (chunk) =>
          chunk.name === 'background' ? '[name].js' : 'assets/[name]-[hash].js',
      },
    },
  },
  test: { environment: 'jsdom' },
});
