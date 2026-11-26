'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { bom, inquiries, lcs, orders, quotes, tna } from '@/lib/db/schema'
import { record, requireActor, requireGate } from '@/lib/actor'
import { int, isoDate, num, run, str, type ActionState } from '@/lib/action'
import { extractInquiry } from '@/lib/extract'
import { nextCode } from '@/lib/codes'
import { addDays, quoteMargin, TNA_TEMPLATE } from '@/lib/domain'
import { pct } from '@/lib/format'

export async function createInquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0
  const result = await run(async () => {
    const actor = await requireActor()
    const buyer = str(fd, 'buyer')
    const body = str(fd, 'body')
    if (!buyer) throw new Error('Buyer is required.')
    if (body.length < 20) throw new Error('Paste the full buyer email.')
    const fields = await extractInquiry(body)
    const v = (k: string) => fields.find((f) => f.key === k)?.value ?? null
    const code = await nextCode(inquiries, 'INQ', 300)
    const [row] = await db
      .insert(inquiries)
      .values({
        code,
        buyer,
        fromEmail: str(fd, 'from_email') || null,
        subject: str(fd, 'subject') || null,
        body,
        fields,
        style: v('style'),
        fabric: v('fabric'),
        quantity: v('quantity') ? Math.round(Number(v('quantity'))) || null : null,
        shipDate: v('shipDate') && /^\d{4}-\d{2}-\d{2}$/.test(v('shipDate')!) ? v('shipDate') : null,
        targetPrice: v('targetPrice') ? Number(v('targetPrice')) || null : null,
      })
      .returning({ id: inquiries.id })
    id = row.id
    await record(actor, 'logged an inquiry', 'inquiry', id, `${code} from ${buyer}`)
  })
  if (result?.error) return result
  redirect(`/os/inquiries/${id}`)
}

export async function confirmInquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  let quoteId = 0
  const result = await run(async () => {
    const actor = await requireActor()
    const id = int(fd, 'id')
    const style = str(fd, 'style')
    if (!style) throw new Error('Style is required before costing.')
    const quantity = int(fd, 'quantity', { min: 100, max: 5_000_000 })
    const shipDate = isoDate(fd, 'ship_date')
    const targetPrice = num(fd, 'target_price', { min: 0, max: 1000 })
    const [inq] = await db.select().from(inquiries).where(eq(inquiries.id, id))
    if (!inq) throw new Error('Inquiry not found.')
    if (inq.status !== 'draft') throw new Error('Already confirmed.')
    await db
      .update(inquiries)
      .set({ style, fabric: str(fd, 'fabric') || null, quantity, shipDate, targetPrice, status: 'confirmed', confirmedBy: actor.id, confirmedAt: new Date() })
      .where(eq(inquiries.id, id))
    const code = await nextCode(quotes, 'QT', 1100)
    const [q] = await db
      .insert(quotes)
      .values({ code, inquiryId: id, buyer: inq.buyer, style, quantity, fob: targetPrice, overhead: 0.35, cmRate: 0.065, fabricRate: 4.2 })
      .returning({ id: quotes.id })
    quoteId = q.id
    await record(actor, 'confirmed the extraction', 'inquiry', id, `${inq.code} → ${code}`)
  })
  if (result?.error) return result
  redirect(`/os/costing/${quoteId}`)
}

export async function saveQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    const id = int(fd, 'id')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q) throw new Error('Quote not found.')
    if (q.status === 'sent' || q.status === 'won') throw new Error('Sent quotes are locked. Start a revision.')
    const values = {
      fabricKg: num(fd, 'fabric_kg', { min: 0, max: 5 }),
      fabricRate: num(fd, 'fabric_rate', { min: 0, max: 50 }),
      cmMinutes: num(fd, 'cm_minutes', { min: 0, max: 120 }),
      cmRate: num(fd, 'cm_rate', { min: 0, max: 1 }),
      trims: num(fd, 'trims', { min: 0, max: 20 }),
      overhead: num(fd, 'overhead', { min: 0, max: 20 }),
      fob: num(fd, 'fob', { min: 0, max: 200 }),
    }
    const changed = q.status !== 'draft'
    await db
      .update(quotes)
      .set({ ...values, status: 'draft', rev: changed ? q.rev + 1 : q.rev, releasedBy: null, releasedAt: null })
      .where(eq(quotes.id, id))
    await record(actor, 'saved the cost sheet', 'quote', id, `${q.code} rev ${changed ? q.rev + 1 : q.rev} · fob $${values.fob.toFixed(2)}`)
    revalidatePath('/os', 'layout')
    return 'cost sheet saved'
  })
}

export async function submitQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    const id = int(fd, 'id')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'draft') throw new Error('Only a draft quote can be submitted.')
    const m = quoteMargin(q)
    const passes = m.pct >= q.floorMargin
    await db.update(quotes).set(passes ? { status: 'released', releasedBy: actor.id, releasedAt: new Date() } : { status: 'held' }).where(eq(quotes.id, id))
    await record(actor, passes ? 'released a quote' : 'submitted a quote below floor', 'quote', id, `${q.code} margin ${pct(m.pct)}`)
    revalidatePath('/os', 'layout')
    return passes ? 'margin clears the floor — released' : `held: ${pct(m.pct)} is under the ${pct(q.floorMargin, 0)} floor. the owner has been asked.`
  })
}

export async function ownerDecision(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireGate('costing')
    const id = int(fd, 'id')
    const decision = str(fd, 'decision')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'held') throw new Error('This quote is not waiting at the gate.')
    if (decision === 'release') {
      const reason = str(fd, 'reason')
      if (reason.length < 5) throw new Error('Write why this margin is acceptable — it goes on the audit trail.')
      await db.update(quotes).set({ status: 'released', releasedBy: actor.id, releasedAt: new Date() }).where(eq(quotes.id, id))
      await record(actor, 'released below floor', 'quote', id, `${q.code}: ${reason}`)
    } else {
      await db.update(quotes).set({ status: 'draft' }).where(eq(quotes.id, id))
      await record(actor, 'sent back for re-costing', 'quote', id, q.code)
    }
    revalidatePath('/os', 'layout')
    return decision === 'release' ? 'released' : 'sent back to merchandising'
  })
}

export async function sendQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    const id = int(fd, 'id')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'released') throw new Error('Only a released quote can go to the buyer.')
    await db.update(quotes).set({ status: 'sent', sentAt: new Date() }).where(eq(quotes.id, id))
    await record(actor, 'sent a quote to the buyer', 'quote', id, `${q.code} at $${q.fob.toFixed(2)}`)
    revalidatePath('/os', 'layout')
    return 'sent to buyer'
  })
}

export async function winQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  let orderId = 0
  const result = await run(async () => {
    const actor = await requireActor()
    const id = int(fd, 'id')
    const lcNumber = str(fd, 'lc_number')
    if (!lcNumber) throw new Error('Enter the buyer PO or master LC number.')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'sent') throw new Error('Only a sent quote can be won.')
    const [inq] = q.inquiryId ? await db.select().from(inquiries).where(eq(inquiries.id, q.inquiryId)) : []
    const shipDate = inq?.shipDate ?? addDays(new Date().toISOString().slice(0, 10), 90)
    const code = await nextCode(orders, 'PO', 2040)
    const ratio = { S: 1, M: 3, L: 3, XL: 2, XXL: 1 }
    const unit = q.quantity / 10
    const sizes = Object.fromEntries(Object.entries(ratio).map(([k, r]) => [k, Math.round(unit * r)]))
    const [o] = await db
      .insert(orders)
      .values({ code, quoteId: id, buyer: q.buyer, style: q.style, fabric: inq?.fabric ?? null, quantity: q.quantity, sizes, shipDate, fob: q.fob })
      .returning({ id: orders.id })
    orderId = o.id
    await db.insert(tna).values(TNA_TEMPLATE.map((m, i) => ({ orderId, name: m.name, ownerDept: m.dept, dueDate: addDays(shipDate, -m.offset), sort: i })))
    const fabricKg = Math.round(q.fabricKg * q.quantity * 1.04)
    await db.insert(bom).values([
      { orderId, material: inq?.fabric ?? 'body fabric', qty: fabricKg, unit: 'kg', rate: q.fabricRate, supplier: null, source: 'import' },
      { orderId, material: 'rib collar & cuff', qty: Math.round(q.quantity * 0.04), unit: 'kg', rate: q.fabricRate * 1.1, source: 'import' },
      { orderId, material: 'buttons, labels, polybags', qty: q.quantity, unit: 'set', rate: q.trims, source: 'local' },
    ])
    await db.insert(lcs).values({
      kind: 'master',
      number: lcNumber,
      orderId,
      amount: q.quantity * q.fob,
      tenorDays: 90,
      status: 'requested',
      latestShipment: shipDate,
      portLoading: 'Chattogram',
      description: q.style,
      quantity: q.quantity,
    })
    await db.update(quotes).set({ status: 'won' }).where(eq(quotes.id, id))
    await record(actor, 'converted a quote into an order', 'order', orderId, `${q.code} → ${code}`)
  })
  if (result?.error) return result
  redirect(`/os/orders/${orderId}`)
}
