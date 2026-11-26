import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from './db'
import { audit, people, type Person } from './db/schema'
import { canPass, GATE_LABEL, ROLE_LABEL, type Gate } from './domain'

export const ACTOR_COOKIE = 'bornil_actor'

/** The staff member the current browser is acting as. Falls back to the owner. */
export async function getActor(): Promise<Person | null> {
  const store = await cookies()
  const id = Number(store.get(ACTOR_COOKIE)?.value)
  if (Number.isInteger(id) && id > 0) {
    const [p] = await db.select().from(people).where(eq(people.id, id)).limit(1)
    if (p) return p
  }
  const [owner] = await db.select().from(people).where(eq(people.role, 'owner')).limit(1)
  return owner ?? null
}

export async function requireActor() {
  const actor = await getActor()
  if (!actor) throw new Error('আগে নমুনা কারখানা লোড করুন বা কর্মী যোগ করুন।')
  return actor
}

export async function requireGate(gate: Gate) {
  const actor = await requireActor()
  if (!canPass(gate, actor.role)) {
    throw new Error(`${actor.name} (${ROLE_LABEL[actor.role] ?? actor.role}) ${GATE_LABEL[gate] ?? gate} গেট ছাড় দিতে পারেন না।`)
  }
  return actor
}

export async function listPeople() {
  return db.select().from(people).orderBy(asc(people.id))
}

export async function record(
  actor: Person,
  action: string,
  entity: string,
  entityId: number | null,
  detail?: string,
) {
  await db.insert(audit).values({
    actorId: actor.id,
    actor: `${actor.name} · ${ROLE_LABEL[actor.role] ?? actor.role}`,
    action,
    entity,
    entityId,
    detail: detail ?? null,
  })
}
