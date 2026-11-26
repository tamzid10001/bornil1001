'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { ACTOR_COOKIE } from '@/lib/actor'
import { seedExampleFactory } from '@/lib/seed'

const cookieOpts = { path: '/', sameSite: 'lax' as const, httpOnly: true, maxAge: 60 * 60 * 24 * 365 }

export async function setActor(formData: FormData) {
  const id = Number(formData.get('actor'))
  if (!Number.isInteger(id) || id <= 0) return
  ;(await cookies()).set(ACTOR_COOKIE, String(id), cookieOpts)
  revalidatePath('/os', 'layout')
}

export async function setLang(formData: FormData) {
  const lang = formData.get('lang') === 'bn' ? 'bn' : 'en'
  ;(await cookies()).set('bornil_lang', lang, cookieOpts)
  revalidatePath('/os', 'layout')
}

export async function loadExampleFactory() {
  await seedExampleFactory()
  revalidatePath('/os', 'layout')
}
