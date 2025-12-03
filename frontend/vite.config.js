import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/create': {
        target: 'https://zgurl.cc',
        changeOrigin: true,
        secure: true,
      },
      '/stats': {
        target: 'https://zgurl.cc',
        changeOrigin: true,
        secure: true,
      },
      '/auth': {
        target: 'https://zgurl.cc',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
