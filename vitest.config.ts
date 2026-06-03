import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'electron/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared')
    }
  }
})
