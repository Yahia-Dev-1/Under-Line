import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/n8n': {
        target: 'http://127.0.0.1:5678',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n/, ''),
        timeout: 600000, // 10 minutes timeout for large PDFs
        proxyTimeout: 600000
      }
    }
  }
})
