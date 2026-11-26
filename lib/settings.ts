import 'server-only'
import { cache } from 'react'
import { asc, eq, getTableColumns, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from './db'
import { factory, floors, lines, roles, settings } from './db/schema'
import { DEFAULT_ROLES, parseConfig, SECTIONS, type Config, type SectionKey } from './config'
import { bn } from './format'

export const getConfig = cache(async (): Promise<Config> => {
  const rows = await db.select({ key: settings.key, value: settings.value }).from(settings)
  return parseConfig(rows)
})

/** Validates a section strictly and stores it; zod problems become one readable Bangla sentence. */
export async function saveSection<K extends SectionKey>(key: K, value: unknown, actorId: number) {
  const result = SECTIONS[key].schema.safeParse(value)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue.path.length ? ` (সারি ${bn(Number(issue.path[0]) + 1 || 1)})` : ''
    throw new Error(`সংরক্ষণ করা যায়নি${where}: প্রতিটি ঘর ঠিকভাবে পূরণ করুন।`)
  }
  await db
    .insert(settings)
    .values({ key, value: result.data as unknown as object, updatedBy: actorId })
    .onConflictDoUpdate({ target: settings.key, set: { value: result.data as unknown as object, updatedBy: actorId, updatedAt: new Date() } })
  return result.data as z.infer<(typeof SECTIONS)[K]['schema']>
}

const { logo: _logo, ...profileColumns } = getTableColumns(factory)

export type FactoryProfile = Omit<typeof factory.$inferSelect, 'logo'> & { exists: boolean; logoUrl: string | null }

const BLANK: Omit<FactoryProfile, 'exists' | 'logoUrl'> = {
  id: 1,
  name: 'আমার কারখানা',
  nameEn: null,
  tagline: null,
  address: null,
  phone: null,
  email: null,
  website: null,
  bin: null,
  erc: null,
  irc: null,
  membership: null,
  logoType: null,
  logoVersion: 0,
  updatedAt: new Date(0),
}

export const getFactory = cache(async (): Promise<FactoryProfile> => {
  const [row] = await db.select(profileColumns).from(factory).where(eq(factory.id, 1)).limit(1)
  const p = row ?? BLANK
  return { ...p, exists: !!row, logoUrl: p.logoType ? `/brand/logo?v=${p.logoVersion}` : null }
})

/** Roles live in the database so factories can rename them and change permissions; seeded once. */
export const getRoles = cache(async () => {
  const read = () => db.select().from(roles).orderBy(asc(roles.sort), asc(roles.id))
  const rows = await read()
  if (rows.length) return rows
  await db
    .insert(roles)
    .values(DEFAULT_ROLES.map((r, i) => ({ key: r.key, name: r.name, permissions: r.permissions, isOwner: !!r.isOwner, sort: i })))
    .onConflictDoNothing()
  return read()
})

export const getFloorPlan = cache(async () => {
  const [fs, ls] = await Promise.all([
    db.select().from(floors).orderBy(asc(floors.sort), asc(floors.id)),
    db.select().from(lines).orderBy(asc(lines.floorId), asc(lines.sort), asc(lines.id)),
  ])
  return { floors: fs, lines: ls }
})

export async function hasAnyFloor() {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(floors)
  return c > 0
}
