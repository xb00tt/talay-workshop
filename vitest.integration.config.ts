import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    globalSetup: ['__tests__/integration/globalSetup.ts'],
    include: ['__tests__/integration/**/*.test.ts'],
    // Run test files serially — shared SQLite DB, no concurrent writes
    fileParallelism: false,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: 'file:./prisma/test.db',
      NEXTAUTH_SECRET: 'test-secret-for-integration-tests',
      NEXTAUTH_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
