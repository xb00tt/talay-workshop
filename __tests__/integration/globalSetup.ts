import { execSync } from 'child_process'
import { existsSync, unlinkSync } from 'fs'

const TEST_DB = './prisma/test.db'

/** Runs once before all integration test files. Creates a fresh test.db with the current schema. */
export async function setup() {
  // Delete stale DB so prisma db push starts from a clean slate
  if (existsSync(TEST_DB))        unlinkSync(TEST_DB)
  if (existsSync(TEST_DB + '-wal')) unlinkSync(TEST_DB + '-wal')
  if (existsSync(TEST_DB + '-shm')) unlinkSync(TEST_DB + '-shm')

  execSync('npx prisma db push --accept-data-loss', {
    env: { ...process.env, DATABASE_URL: 'file:./prisma/test.db' },
    stdio: 'pipe',
  })
}

export async function teardown() {
  // Connection closes on process exit; no action needed
}
