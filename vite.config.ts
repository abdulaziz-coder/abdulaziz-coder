import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  root: 'frontend',
  plugins: [react(), tailwindcss()],
  server: {
    strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  build: {
    outDir: '../build', emptyOutDir: true,
    rollupOptions: { output: { manualChunks: {
      react: ['react', 'react-dom'], motion: ['framer-motion'], query: ['@tanstack/react-query'], validation: ['zod'],
    } } },
  },
});
