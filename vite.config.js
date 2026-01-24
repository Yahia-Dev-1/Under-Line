import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/translate': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 600000, // 10 minutes timeout for large PDFs
        proxyTimeout: 600000
      },
      '/auth': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 600000
      },
      '/translations': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 600000
      },
      '/download-pdf': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        timeout: 600000
      }
    }
  }
})
