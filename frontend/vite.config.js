import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev server proxies REST + WebSocket to the FastAPI backend on :8000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/ws': { target: 'ws://localhost:8000', ws: true },
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
