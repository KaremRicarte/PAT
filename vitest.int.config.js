import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    include: ['tests/int/**/*.test.js'],
    testTimeout: 30000,
    fileParallelism: false,
    env: loadEnv(mode, process.cwd(), ''),
  },
}))
