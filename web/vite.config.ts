import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa las librerías grandes para que el navegador pueda cachearlas
        // y para evitar un único chunk de más de 500 kB.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'data-vendor': ['@tanstack/react-query', 'axios'],
          'forms-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
});
