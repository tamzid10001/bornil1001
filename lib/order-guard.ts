import 'server-only'
import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from './db'
import { lines, orders, type Order } from './db/schema'
import { int } from './action'

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

/** A line picked from the floor plan; it must exist and be running. */
export async function activeLine(fd: FormData, key = 'line') {
  const id = int(fd, key, { min: 1, label: 'লাইন' })
  const [line] = await db.select().from(lines).where(and(eq(lines.id, id), eq(lines.active, true)))
  if (!line) throw new Error('ফ্লোর প্ল্যান থেকে একটি চালু লাইন বেছে নিন।')
  return line
}
