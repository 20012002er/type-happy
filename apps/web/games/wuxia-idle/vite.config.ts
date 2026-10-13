import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  // 集成到 type-happy 主站:构建产物由主站静态托管在 /games/wuxia/,
  // 资源引用需以该路径为前缀(产物 rsync 到 apps/web/public/games/wuxia/)
  base: '/games/wuxia/',
  plugins: [
    vue()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ['vue', 'vue-router', 'pinia'],
          i18n: ['vue-i18n'],
          utils: ['lodash-es', 'big.js', 'dayjs']
        }
      }
    }
  }
})
