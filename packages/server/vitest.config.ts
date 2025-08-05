import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

async function getInitSql() {
  const dirName = path.resolve(__dirname, 'drizzle')
  const list = (await readdir(dirName)).filter((it) => it.endsWith('.sql')).sort((a, b) => a.localeCompare(b))
  return (await Promise.all(list.map((name) => readFile(path.resolve(dirName, name), 'utf-8')))).join('\n')
}

export default defineWorkersConfig(async () => {
  return {
    test: {
      include: ['./src/**/*.test.ts'],
      poolOptions: {
        workers: {
          wrangler: { configPath: './wrangler.json' },
          miniflare: {
            bindings: {
              APP_ENV: 'development',
              JWT_SECRET: 'test-secret',
              TEST_INIT_SQL: await getInitSql(),
            },
          },
        },
      },
    },
  }
})
