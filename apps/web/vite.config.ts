import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const apiProxy = {
  '/api': {
    target: process.env.PRERENDER_API ?? 'http://localhost:3001',
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: apiProxy,
  },
  preview: {
    port: Number(process.env.PRERENDER_PORT ?? 4173),
    proxy: apiProxy,
  },
})
