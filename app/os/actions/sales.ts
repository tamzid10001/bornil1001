'use server'

import { and, eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { bom, inquiries, lcs, lines, orders, quotes, tna } from '@/lib/db/schema'
import { record, requireGate, requirePermission } from '@/lib/actor'
import { int, isoDate, num, run, str, type ActionState } from '@/lib/action'
import { extractInquiry } from '@/lib/extract'
import { nextCode } from '@/lib/codes'
import { getConfig } from '@/lib/settings'
import { backSchedule, today, type Category, type Config } from '@/lib/config'
import { quoteMargin } from '@/lib/domain'
import { bn, pct, tk } from '@/lib/format'

function pickCategory(config: Config, key: string) {
  const c = config.categories.find((x) => x.key === key)
  if (!c) throw new Error('পোশাকের ধরন বেছে নিন — সেটিংসে নতুন ধরন যোগ করা যায়।')
  return c
}

/** Best guess from the buyer's words; only returns a category this factory actually makes. */
function guessCategory(config: Config, text: string) {
  const rules: [RegExp, string][] = [
    [/denim|jean/i, 'denim'],
    [/chino|trouser|pant|twill/i, 'woven-bottom'],
    [/sweatshirt|fleece|hoodie/i, 'knit-fleece'],
    [/sweater|cardigan|pullover/i, 'sweater'],
    [/jacket|parka|coat/i, 'outerwear'],
    [/shirt|poplin|oxford/i, 'woven-top'],
    [/polo|tee|t-shirt|jersey|pique|piqué/i, 'knit-top'],
  ]
  const keys = new Set(config.categories.map((c) => c.key))
  const hit = rules.find(([re, key]) => keys.has(key) && re.test(text))
  return hit?.[1] ?? config.categories[0].key
}

/** Splits a quantity across sizes by the category ratio; rounding leftovers go to the largest share. */
function splitSizes(c: Category, quantity: number) {
  const ratio = c.sizes.map((_, i) => c.ratio[i] ?? 1)
  const total = ratio.reduce((s, r) => s + r, 0) || 1
  const sizes: Record<string, number> = Object.fromEntries(c.sizes.map((s, i) => [s, Math.floor((quantity * ratio[i]) / total)]))
  const biggest = c.sizes[ratio.indexOf(Math.max(...ratio))]
  sizes[biggest] += quantity - Object.values(sizes).reduce((s, v) => s + v, 0)
  return sizes
}

async function sewingLineCount() {
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(lines).where(and(eq(lines.active, true), eq(lines.kind, 'sewing')))
  return c || 4
}

export async function createInquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  let id = 0
  const result = await run(async () => {
    const actor = await requirePermission('inquiry.manage')
    const config = await getConfig()
    const buyer = str(fd, 'buyer')
    const body = str(fd, 'body')
    if (!buyer) throw new Error('ক্রেতার নাম দিতে হবে।')
    if (body.length < 20) throw new Error('ক্রেতার পুরো ইমেইল পেস্ট করুন।')
    if (body.length > 40_000) throw new Error('ইমেইলটি অনেক বড় — মূল অংশটুকু পেস্ট করুন।')
    const fields = await extractInquiry(body)
    const v = (k: string) => fields.find((f) => f.key === k)?.value ?? null
    const code = await nextCode('inquiry', config.numbering)
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
        category: guessCategory(config, `${str(fd, 'subject')} ${body}`),
        fabric: v('fabric'),
        quantity: v('quantity') ? Math.round(Number(v('quantity'))) || null : null,
        shipDate: v('shipDate') && /^\d{4}-\d{2}-\d{2}$/.test(v('shipDate')!) ? v('shipDate') : null,
        targetPrice: v('targetPrice') ? Number(v('targetPrice')) || null : null,
      })
      .returning({ id: inquiries.id })
    id = row.id
    await record(actor, 'ইনকোয়ারি লিখেছেন', 'inquiry', id, `${code} · ${buyer}`)
  })
  if (result?.error) return result
  redirect(`/os/inquiries/${id}`)
}

async function draftQuote(
  config: Config,
  v: { inquiryId: number | null; buyer: string; style: string; category: Category; quantity: number; targetPrice: number },
) {
  const code = await nextCode('quote', config.numbering)
  const [q] = await db
    .insert(quotes)
    .values({
      code,
      inquiryId: v.inquiryId,
      buyer: v.buyer,
      style: v.style,
      category: v.category.key,
      fabricUnit: v.category.unit,
      quantity: v.quantity,
      fob: v.targetPrice,
      overhead: config.costing.overhead,
      cmRate: config.costing.cmRate,
      fabricRate: config.costing.fabricRate,
      floorMargin: config.costing.floorMargin,
    })
    .returning({ id: quotes.id })
  return { id: q.id, code }
}

export async function confirmInquiry(_: ActionState, fd: FormData): Promise<ActionState> {
  let quoteId = 0
  const result = await run(async () => {
    const actor = await requirePermission('inquiry.manage')
    const config = await getConfig()
    const id = int(fd, 'id')
    const style = str(fd, 'style')
    if (!style) throw new Error('কস্টিংয়ের আগে স্টাইল দিতে হবে।')
    const category = pickCategory(config, str(fd, 'category'))
    const quantity = int(fd, 'quantity', { min: 1, max: 10_000_000, label: 'পরিমাণ' })
    const shipDate = isoDate(fd, 'ship_date')
    const targetPrice = num(fd, 'target_price', { min: 0, max: 1_000_000, label: 'লক্ষ্য দর' })
    const [inq] = await db.select().from(inquiries).where(eq(inquiries.id, id))
    if (!inq) throw new Error('ইনকোয়ারি পাওয়া যায়নি।')
    if (inq.status !== 'draft') throw new Error('আগেই নিশ্চিত করা হয়েছে।')
    await db
      .update(inquiries)
      .set({ style, category: category.key, fabric: str(fd, 'fabric') || null, quantity, shipDate, targetPrice, status: 'confirmed', confirmedBy: actor.id, confirmedAt: new Date() })
      .where(eq(inquiries.id, id))
    const q = await draftQuote(config, { inquiryId: id, buyer: inq.buyer, style, category, quantity, targetPrice })
    quoteId = q.id
    await record(actor, 'ইমেইলের তথ্য নিশ্চিত করেছেন', 'inquiry', id, `${inq.code} → ${q.code}`)
  })
  if (result?.error) return result
  redirect(`/os/costing/${quoteId}`)
}

/** A cost sheet without an inquiry, for repeat orders and buyers who send specs by other means. */
export async function createQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  let quoteId = 0
  const result = await run(async () => {
    const actor = await requirePermission('costing.edit')
    const config = await getConfig()
    const buyer = str(fd, 'buyer')
    const style = str(fd, 'style')
    if (!buyer || !style) throw new Error('ক্রেতা ও স্টাইল দিতে হবে।')
    const category = pickCategory(config, str(fd, 'category'))
    const quantity = int(fd, 'quantity', { min: 1, max: 10_000_000, label: 'পরিমাণ' })
    const targetPrice = num(fd, 'target_price', { min: 0, max: 1_000_000, label: 'লক্ষ্য দর' })
    const q = await draftQuote(config, { inquiryId: null, buyer, style, category, quantity, targetPrice })
    quoteId = q.id
    await record(actor, 'নতুন কস্ট শিট খুলেছেন', 'quote', q.id, `${q.code} · ${buyer}`)
  })
  if (result?.error) return result
  redirect(`/os/costing/${quoteId}`)
}

export async function saveQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('costing.edit')
    const id = int(fd, 'id')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q) throw new Error('কোটেশন পাওয়া যায়নি।')
    if (q.status === 'sent' || q.status === 'won') throw new Error('পাঠানো কোটেশন আর বদলানো যায় না। নতুন সংস্করণ শুরু করুন।')
    const values = {
      fabricQty: num(fd, 'fabric_qty', { min: 0, max: 50, label: 'পিসপ্রতি কাপড়' }),
      fabricRate: num(fd, 'fabric_rate', { min: 0, max: 1_000_000, label: 'কাপড়ের দর' }),
      cmMinutes: num(fd, 'cm_minutes', { min: 0, max: 600, label: 'এসএমভি' }),
      cmRate: num(fd, 'cm_rate', { min: 0, max: 10_000, label: 'মিনিটপ্রতি সিএম' }),
      trims: num(fd, 'trims', { min: 0, max: 1_000_000, label: 'ট্রিমস' }),
      overhead: num(fd, 'overhead', { min: 0, max: 1_000_000, label: 'ওভারহেড' }),
      fob: num(fd, 'fob', { min: 0, max: 1_000_000, label: 'এফওবি' }),
    }
    const changed = q.status !== 'draft'
    await db
      .update(quotes)
      .set({ ...values, status: 'draft', rev: changed ? q.rev + 1 : q.rev, releasedBy: null, releasedAt: null })
      .where(eq(quotes.id, id))
    await record(actor, 'কস্ট শিট সংরক্ষণ করেছেন', 'quote', id, `${q.code} সংস্করণ ${bn(changed ? q.rev + 1 : q.rev)} · এফওবি ${tk(values.fob)}`)
    revalidatePath('/os', 'layout')
    return 'কস্ট শিট সংরক্ষণ করা হয়েছে'
  })
}

export async function submitQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('costing.edit')
    const config = await getConfig()
    const id = int(fd, 'id')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'draft') throw new Error('শুধু খসড়া কোটেশন জমা দেওয়া যায়।')
    const m = quoteMargin(q)
    const passes = !config.gates.costing || m.pct >= q.floorMargin
    await db.update(quotes).set(passes ? { status: 'released', releasedBy: actor.id, releasedAt: new Date() } : { status: 'held' }).where(eq(quotes.id, id))
    await record(actor, passes ? 'কোটেশন ছাড় দিয়েছেন' : 'ন্যূনতম মার্জিনের নিচের কোটেশন জমা দিয়েছেন', 'quote', id, `${q.code} মার্জিন ${pct(m.pct)}`)
    revalidatePath('/os', 'layout')
    return passes ? 'কোটেশন ছাড় পেয়েছে — এখন ক্রেতাকে পাঠানো যাবে' : `আটকে আছে: মার্জিন ${pct(m.pct)}, ন্যূনতম ${pct(q.floorMargin, 0)}। অনুমোদনের জন্য পাঠানো হয়েছে।`
  })
}

export async function ownerDecision(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireGate('costing')
    const id = int(fd, 'id')
    const decision = str(fd, 'decision')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'held') throw new Error('এই কোটেশন গেটে অপেক্ষায় নেই।')
    if (decision === 'release') {
      const reason = str(fd, 'reason')
      if (reason.length < 5) throw new Error('কেন এই মার্জিন গ্রহণযোগ্য তা লিখুন — এটি অডিট ট্রেইলে থাকবে।')
      await db.update(quotes).set({ status: 'released', releasedBy: actor.id, releasedAt: new Date() }).where(eq(quotes.id, id))
      await record(actor, 'ন্যূনতম মার্জিনের নিচে ছাড় দিয়েছেন', 'quote', id, `${q.code}: ${reason}`)
    } else {
      await db.update(quotes).set({ status: 'draft' }).where(eq(quotes.id, id))
      await record(actor, 'আবার কস্টিংয়ের জন্য ফেরত পাঠিয়েছেন', 'quote', id, q.code)
    }
    revalidatePath('/os', 'layout')
    return decision === 'release' ? 'ছাড় দেওয়া হয়েছে' : 'মার্চেন্ডাইজিংয়ে ফেরত পাঠানো হয়েছে'
  })
}

export async function sendQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('costing.edit')
    const id = int(fd, 'id')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'released') throw new Error('শুধু ছাড়প্রাপ্ত কোটেশন ক্রেতার কাছে পাঠানো যায়।')
    await db.update(quotes).set({ status: 'sent', sentAt: new Date() }).where(eq(quotes.id, id))
    await record(actor, 'ক্রেতাকে কোটেশন পাঠিয়েছেন', 'quote', id, `${q.code} · ${tk(q.fob)}`)
    revalidatePath('/os', 'layout')
    return 'ক্রেতাকে পাঠানো হয়েছে'
  })
}

type NewOrder = {
  quoteId: number | null
  buyer: string
  style: string
  category: Category
  fabric: string | null
  quantity: number
  shipDate: string
  fob: number
  lcNumber: string
  fabricQty: number
  fabricUnit: string
  fabricRate: number
  trims: number
}

/** Creates the order with its sizes, critical path, starting BOM and (if used) the master LC request. */
async function openOrder(config: Config, v: NewOrder) {
  const code = await nextCode('order', config.numbering)
  const plan = { lines: await sewingLineCount(), perLineDay: config.production.perLineDay, fabricLeadDays: config.production.fabricLeadDays }
  const [o] = await db
    .insert(orders)
    .values({
      code,
      quoteId: v.quoteId,
      buyer: v.buyer,
      style: v.style,
      category: v.category.key,
      fabric: v.fabric,
      quantity: v.quantity,
      sizes: splitSizes(v.category, v.quantity),
      shipDate: v.shipDate,
      fob: v.fob,
      planLines: plan.lines,
      planPerLineDay: plan.perLineDay,
      planFabricLeadDays: plan.fabricLeadDays,
    })
    .returning({ id: orders.id })
  const schedule = backSchedule(config.tna, v.shipDate, v.quantity, plan, v.category.key)
  if (schedule.rows.length) {
    await db.insert(tna).values(schedule.rows.map((m) => ({ orderId: o.id, name: m.key, label: m.label, ownerDept: m.dept, dueDate: m.due, sort: m.sort })))
  }
  const materials: (typeof bom.$inferInsert)[] = []
  if (v.fabricQty > 0) {
    const qty = Math.ceil(v.fabricQty * v.quantity * (1 + config.costing.wastagePct / 100))
    materials.push({ orderId: o.id, material: v.fabric ?? 'মূল কাপড়', kind: 'fabric', qty, unit: v.fabricUnit, rate: v.fabricRate, source: 'import' })
  }
  if (v.trims > 0) materials.push({ orderId: o.id, material: 'ট্রিমস ও প্যাকিং', kind: 'trim', qty: v.quantity, unit: 'set', rate: v.trims, source: 'local' })
  if (materials.length) await db.insert(bom).values(materials)
  if (config.modules.commercial && v.lcNumber) {
    await db.insert(lcs).values({
      kind: 'master',
      number: v.lcNumber,
      orderId: o.id,
      amount: v.quantity * v.fob,
      tenorDays: config.commercial.tenorDays,
      status: 'requested',
      latestShipment: v.shipDate,
      portLoading: config.commercial.portLoading,
      description: v.style,
      quantity: v.quantity,
    })
  }
  return { id: o.id, code }
}

export async function winQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  let orderId = 0
  const result = await run(async () => {
    const actor = await requirePermission('order.create')
    const config = await getConfig()
    const id = int(fd, 'id')
    const lcNumber = str(fd, 'lc_number')
    if (config.modules.commercial && !lcNumber) throw new Error('ক্রেতার পিও বা মাস্টার এলসি নম্বর দিন।')
    const shipDate = isoDate(fd, 'ship_date')
    if (shipDate <= today()) throw new Error('শিপমেন্টের তারিখ আজকের পরে হতে হবে।')
    const [q] = await db.select().from(quotes).where(eq(quotes.id, id))
    if (!q || q.status !== 'sent') throw new Error('শুধু পাঠানো কোটেশন থেকেই অর্ডার নেওয়া যায়।')
    const [inq] = q.inquiryId ? await db.select().from(inquiries).where(eq(inquiries.id, q.inquiryId)) : []
    const category = config.categories.find((c) => c.key === q.category) ?? config.categories[0]
    const o = await openOrder(config, {
      quoteId: id,
      buyer: q.buyer,
      style: q.style,
      category,
      fabric: inq?.fabric ?? null,
      quantity: q.quantity,
      shipDate,
      fob: q.fob,
      lcNumber,
      fabricQty: q.fabricQty,
      fabricUnit: q.fabricUnit,
      fabricRate: q.fabricRate,
      trims: q.trims,
    })
    orderId = o.id
    await db.update(quotes).set({ status: 'won' }).where(eq(quotes.id, id))
    await record(actor, 'কোটেশনকে অর্ডারে রূপান্তর করেছেন', 'order', o.id, `${q.code} → ${o.code}`)
  })
  if (result?.error) return result
  redirect(`/os/orders/${orderId}`)
}

/** An order taken directly, for factories that cost outside the system or run repeat programmes. */
export async function createOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  let orderId = 0
  const result = await run(async () => {
    const actor = await requirePermission('order.create')
    const config = await getConfig()
    const buyer = str(fd, 'buyer')
    const style = str(fd, 'style')
    if (!buyer || !style) throw new Error('ক্রেতা ও স্টাইল দিতে হবে।')
    const category = pickCategory(config, str(fd, 'category'))
    const shipDate = isoDate(fd, 'ship_date')
    if (shipDate <= today()) throw new Error('শিপমেন্টের তারিখ আজকের পরে হতে হবে।')
    const lcNumber = str(fd, 'lc_number')
    const fabricRaw = str(fd, 'fabric_qty')
    const o = await openOrder(config, {
      quoteId: null,
      buyer,
      style,
      category,
      fabric: str(fd, 'fabric') || null,
      quantity: int(fd, 'quantity', { min: 1, max: 10_000_000, label: 'পরিমাণ' }),
      shipDate,
      fob: num(fd, 'fob', { min: 0, max: 1_000_000, label: 'পিসপ্রতি দর' }),
      lcNumber,
      fabricQty: fabricRaw ? num(fd, 'fabric_qty', { min: 0, max: 50, label: 'পিসপ্রতি কাপড়' }) : 0,
      fabricUnit: category.unit,
      fabricRate: config.costing.fabricRate,
      trims: 0,
    })
    orderId = o.id
    await record(actor, 'সরাসরি অর্ডার নিয়েছেন', 'order', o.id, `${o.code} · ${buyer} · শিপমেন্ট ${shipDate}`)
  })
  if (result?.error) return result
  redirect(`/os/orders/${orderId}`)
}
