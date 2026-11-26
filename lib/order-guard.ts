import 'server-only'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from './db'
import { orders, type Order } from './db/schema'
import { int } from './action'
import { ROLE_LABEL } from './domain'

export async function loadOpenOrder(fd: FormData) {
  const id = int(fd, 'order_id')
  const [o] = await db.select().from(orders).where(eq(orders.id, id))
  if (!o) throw new Error('অর্ডার পাওয়া যায়নি।')
  if (o.closedAt) throw new Error(`${o.code} বন্ধ হয়ে গেছে।`)
  return o
}

export function refreshOrder(o: Order) {
  revalidatePath('/os', 'layout')
  revalidatePath(`/os/orders/${o.id}`, 'layout')
}

export function allowRoles(role: string, allowed: string[], what: string) {
  if (role !== 'owner' && !allowed.includes(role)) throw new Error(`শুধু ${allowed.map((r) => ROLE_LABEL[r] ?? r).join(' বা ')} ${what} পারেন।`)
}
