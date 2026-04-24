import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/ - build v2
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
});
