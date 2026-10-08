import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// API runtime must not depend on the client's dev proxy or build configuration.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
  },
});
