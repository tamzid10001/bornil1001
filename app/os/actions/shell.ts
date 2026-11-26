'use server'

import { and, eq } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { people } from '@/lib/db/schema'
import { ACTOR_COOKIE } from '@/lib/actor'
import { seedExampleFactory } from '@/lib/seed'

const cookieOpts = { path: '/', sameSite: 'lax' as const, httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 }

export async function setActor(formData: FormData) {
  const id = Number(formData.get('actor'))
  if (!Number.isInteger(id) || id <= 0) return
  const [p] = await db.select({ id: people.id }).from(people).where(and(eq(people.id, id), eq(people.active, true)))
  if (!p) return
  ;(await cookies()).set(ACTOR_COOKIE, String(p.id), cookieOpts)
  revalidatePath('/os', 'layout')
}

export async function loadExampleFactory() {
  await seedExampleFactory()
  revalidatePath('/os', 'layout')
}
