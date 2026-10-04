import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { cloudflareTurnPlugin } from './server/turn.js';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), cloudflareTurnPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 8003,
  },
});
