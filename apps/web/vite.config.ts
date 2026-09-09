import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiUrl = process.env.VITE_API_URL ?? 'http://127.0.0.1:4001';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: Object.fromEntries(['/api', '/assets', '/openapi.json'].map((path) => [path, { target: apiUrl }])),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    restoreMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
