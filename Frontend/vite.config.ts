import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // Git Bash cwd is `c:/...` (lowercase). Vitest keys runner state by
    // filepath; mixed drive casing makes `describe`/`afterEach` miss the suite.
    root: fileURLToPath(new URL('./', import.meta.url)),
  },
})
