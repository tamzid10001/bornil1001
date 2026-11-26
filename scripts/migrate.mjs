// Applies db/migrations/*.sql in order, once each, inside a transaction.
// Safe to run on every deploy: applied files are recorded in _migrations and
// a transaction-level advisory lock stops two deploys migrating at once.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

for (const file of ['.env.development.local', '.env.local', '.env']) {
  if (!process.env.DATABASE_URL && existsSync(file)) process.loadEnvFile(file)
}

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set — connect a Postgres database before migrating.')
  process.exit(1)
}

const dir = join(process.cwd(), 'db', 'migrations')
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .sort()

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  await client.query('create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())')
  const applied = new Set((await client.query('select name from _migrations')).rows.map((r) => r.name))
  const pending = files.filter((f) => !applied.has(f))
  if (!pending.length) console.log('migrations: up to date')

  for (const file of pending) {
    await client.query('begin')
    try {
      await client.query('select pg_advisory_xact_lock(727274001)')
      const { rowCount } = await client.query('select 1 from _migrations where name = $1', [file])
      if (rowCount) {
        await client.query('rollback')
        continue
      }
      await client.query(readFileSync(join(dir, file), 'utf8'))
      await client.query('insert into _migrations (name) values ($1)', [file])
      await client.query('commit')
      console.log(`migrations: applied ${file}`)
    } catch (error) {
      await client.query('rollback')
      throw new Error(`${file}: ${error.message}`)
    }
  }
} catch (error) {
  console.error(`migrations failed — ${error.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
