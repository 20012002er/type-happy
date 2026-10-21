import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  build: {
    outDir: '../../public/games/taoyuan',
    emptyOutDir: true
  },
  plugins: [
    vue({
      template: {
        compilerOptions: {
          comments: false
        }
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src')
    }
  }
})
