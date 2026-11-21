import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Pin the proxy to IPv4; localhost may resolve to ::1 while Flask listens on IPv4.
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
})
