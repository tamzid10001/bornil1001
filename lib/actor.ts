import 'server-only'
import { cache } from 'react'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from './db'
import { audit, people, type Person, type Role } from './db/schema'
import { GATE_INFO, PERMISSION_KEYS, PERMISSION_LABEL, type Gate, type Permission } from './config'
import { getRoles } from './settings'

export const ACTOR_COOKIE = 'bornil_actor'

export type Actor = Person & { roleName: string; isOwner: boolean; permissions: ReadonlySet<string> }

function toActor(p: Person, all: Role[]): Actor {
  const r = all.find((x) => x.key === p.role)
  return { ...p, roleName: r?.name ?? p.role, isOwner: !!r?.isOwner, permissions: new Set(r?.permissions ?? []) }
}

/** The staff member the current browser is acting as. Falls back to the first active owner. */
export const getActor = cache(async (): Promise<Actor | null> => {
  const [store, all] = await Promise.all([cookies(), getRoles()])
  const id = Number(store.get(ACTOR_COOKIE)?.value)
  if (Number.isInteger(id) && id > 0) {
    const [p] = await db.select().from(people).where(eq(people.id, id)).limit(1)
    if (p?.active) return toActor(p, all)
  }
  const ownerKeys = all.filter((r) => r.isOwner).map((r) => r.key)
  if (!ownerKeys.length) return null
  const [owner] = await db
    .select()
    .from(people)
    .where(and(inArray(people.role, ownerKeys), eq(people.active, true)))
    .orderBy(asc(people.id))
    .limit(1)
  return owner ? toActor(owner, all) : null
})

export function can(actor: Actor | null | undefined, perm: Permission) {
  return !!actor && (actor.isOwner || actor.permissions.has(perm))
}

export type Grants = Record<Permission, boolean>

/** Every permission as a plain boolean, so it can be handed to any component. */
export function grantsFor(actor: Actor | null | undefined): Grants {
  return Object.fromEntries(PERMISSION_KEYS.map((p) => [p, can(actor, p as Permission)])) as Grants
}

export async function requireActor() {
  const actor = await getActor()
  if (!actor) throw new Error('আগে কারখানা সেটআপ করুন বা কর্মী যোগ করুন।')
  return actor
}

export async function requirePermission(perm: Permission | readonly Permission[]) {
  const actor = await requireActor()
  const list = typeof perm === 'string' ? [perm] : perm
  if (!list.some((p) => can(actor, p))) {
    throw new Error(`${actor.name} (${actor.roleName})-এর “${PERMISSION_LABEL[list[0]]}” অনুমতি নেই। মালিক সেটিংস থেকে ভূমিকার অনুমতি বদলাতে পারেন।`)
  }
  return actor
}

export async function requireGate(gate: Gate) {
  return requirePermission(GATE_INFO[gate].permission)
}

export async function listPeople() {
  return db.select().from(people).orderBy(asc(people.id))
}

export async function record(actor: Actor, action: string, entity: string, entityId: number | null, detail?: string) {
  await db.insert(audit).values({
    actorId: actor.id,
    actor: `${actor.name} · ${actor.roleName}`,
    action,
    entity,
    entityId,
    detail: detail ?? null,
  })
}
