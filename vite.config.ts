import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    // Code-Splitting: Vendor-Chunks separat für besseres Caching
    rollupOptions: {
      output: {
        manualChunks: {
          // React core → ändert sich selten, wird gut gecached
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Markdown-Rendering → nur im Reader gebraucht
          'vendor-markdown': ['react-markdown', 'remark-gfm'],
        },
      },
    },
  },
})
