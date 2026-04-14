import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Increase chunk size warning limit (some AI libraries are large)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching (Function required for Vite 8 / Rolldown)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor';
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('sonner')) return 'ui';
            if (id.includes('react-markdown') || id.includes('react-syntax-highlighter') || id.includes('remark') || id.includes('rehype')) return 'markdown';
            if (id.includes('recharts')) return 'charts';
          }
        },
      },
    },
  },
})
