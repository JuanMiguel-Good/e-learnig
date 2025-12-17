import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync } from 'fs';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-pdf-worker',
      writeBundle() {
        try {
          copyFileSync(
            resolve(__dirname, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs'),
            resolve(__dirname, 'dist/pdf.worker.min.mjs')
          );
        } catch (err) {
          console.warn('Could not copy PDF worker:', err);
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
