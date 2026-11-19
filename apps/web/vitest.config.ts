import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['tests/{unit,component}/**/*.spec.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/learning/**/*.{ts,vue}'],
      thresholds: {
        statements: 95,
        functions: 95,
        lines: 95,
        branches: 90,
      },
    },
  },
})
