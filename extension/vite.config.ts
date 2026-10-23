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
        content: entry('./src/content.ts'),
      },
      output: {
        // the manifest refers to these two by name
        entryFileNames: (chunk) =>
          chunk.name === 'background' || chunk.name === 'content'
            ? '[name].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  test: { environment: 'jsdom' },
});
