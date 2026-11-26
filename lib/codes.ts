import 'server-only'
import { sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { db } from './db'

export async function nextCode(table: PgTable, prefix: string, base: number) {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(table)
  return `${prefix}-${base + c + 1}`
}
