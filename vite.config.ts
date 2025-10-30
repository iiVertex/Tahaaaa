import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  server: {
    host: '::',
    port: 8080,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.BACKEND_PORT || 3001}`,
        changeOrigin: true,
        secure: false
      }
    }
  },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});


