import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'app',
  envDir: '..',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'app/index.html'),
        admin: resolve(import.meta.dirname, 'app/admin.html'),
      },
    },
  },
})
