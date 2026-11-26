'use server'

import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bl, bom, bondLedger, cartons, invoices, lcAmendments, lcs, orders, techPacks, tna, ud } from '@/lib/db/schema'
import { record, requirePermission } from '@/lib/actor'
import { int, isoDate, num, run, str, type ActionState } from '@/lib/action'
import { loadOpenOrder, refreshOrder } from '@/lib/order-guard'
import { nextCode } from '@/lib/codes'
import { getConfig } from '@/lib/settings'
import { backSchedule, today, unitLabel } from '@/lib/config'
import { blChecks } from '@/lib/queries'
import { invoiceChecks, overlappingRange, packingTotals } from '@/lib/export-checks'
import { readTechPack } from '@/lib/techpack'
import { bn, day, n, tk } from '@/lib/format'

/* ---------- backward scheduling ---------- */

export async function replanTna(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('plan.manage')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    if (o.tnaCommitted) throw new Error('পরিকল্পনা নিশ্চিত হয়ে গেছে — এখন আর তারিখ বদলানো যায় না।')
    const plan = {
      lines: int(fd, 'lines', { min: 1, max: 200, label: 'লাইন সংখ্যা' }),
      perLineDay: int(fd, 'per_line_day', { min: 10, max: 20000, label: 'লাইনপ্রতি দৈনিক উৎপাদন' }),
      fabricLeadDays: int(fd, 'fabric_lead_days', { min: 1, max: 180, label: 'কাপড়ের লিড টাইম' }),
    }
    const s = backSchedule(config.tna, o.shipDate, o.quantity, plan, o.category)
    const done = new Map((await db.select().from(tna).where(eq(tna.orderId, o.id))).map((m) => [m.name, m.doneAt]))
    await db.transaction(async (tx) => {
      await tx.update(orders).set({ planLines: plan.lines, planPerLineDay: plan.perLineDay, planFabricLeadDays: plan.fabricLeadDays }).where(eq(orders.id, o.id))
      await tx.delete(tna).where(eq(tna.orderId, o.id))
      if (s.rows.length) {
        await tx
          .insert(tna)
          .values(s.rows.map((m) => ({ orderId: o.id, name: m.key, label: m.label, ownerDept: m.dept, dueDate: m.due, sort: m.sort, doneAt: done.get(m.key) ?? null })))
      }
    })
    await record(actor, 'ক্রিটিক্যাল পাথ নতুন করে হিসাব করেছেন', 'order', o.id, `${o.code}: ${bn(plan.lines)}টি লাইন, সেলাই ${bn(s.sewingDays)} দিন`)
    refreshOrder(o)
    return s.slack < 0 ? `সময় কম: শুরু করতে ${bn(-s.slack)} দিন দেরি হয়ে গেছে। লাইন বা লিড টাইম বদলান।` : `পরিকল্পনা হালনাগাদ হয়েছে — হাতে ${bn(s.slack)} দিন বাড়তি সময় আছে`
  })
}

/* ---------- LC amendments ---------- */

const AMENDABLE: Record<string, { label: string; kind: 'money' | 'date' | 'int' | 'text' }> = {
  amount: { label: 'এলসির মূল্য', kind: 'money' },
  latestShipment: { label: 'সর্বশেষ শিপমেন্ট', kind: 'date' },
  quantity: { label: 'পরিমাণ', kind: 'int' },
  portDischarge: { label: 'খালাস বন্দর', kind: 'text' },
  description: { label: 'পণ্যের বিবরণ', kind: 'text' },
}

export async function amendLc(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('commercial.manage')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    const lcId = int(fd, 'lc_id')
    const field = str(fd, 'field')
    const spec = AMENDABLE[field]
    if (!spec) throw new Error('কোন তথ্য সংশোধন হচ্ছে তা বেছে নিন।')
    const reason = str(fd, 'reason')
    if (reason.length < 3) throw new Error('সংশোধনীর কারণ লিখুন।')
    const [lc] = await db.select().from(lcs).where(and(eq(lcs.id, lcId), eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
    if (!lc) throw new Error('মাস্টার এলসি পাওয়া যায়নি।')
    if (lc.status !== 'opened') throw new Error('এলসি খোলার পরই সংশোধনী লেখা যায়।')
    const [sent] = await db.select({ id: bl.id }).from(bl).where(and(eq(bl.orderId, o.id), eq(bl.status, 'released')))
    if (sent) throw new Error('কাগজপত্র ব্যাংকে চলে গেছে — এখন আর এলসি সংশোধনী লেখা যাবে না।')

    let value: string | number
    if (spec.kind === 'money') value = num(fd, 'value', { min: 1, max: 10_000_000_000, label: spec.label })
    else if (spec.kind === 'int') value = int(fd, 'value', { min: 1, max: 5_000_000, label: spec.label })
    else if (spec.kind === 'date') value = isoDate(fd, 'value')
    else {
      value = str(fd, 'value')
      if (!value) throw new Error(`নতুন ${spec.label} লিখুন।`)
    }
    const old = (lc as Record<string, unknown>)[field]
    if (String(old ?? '') === String(value)) throw new Error('নতুন মান আগের মানের মতোই।')

    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(lcAmendments).where(eq(lcAmendments.lcId, lc.id))
    await db.update(lcs).set({ [field]: value }).where(eq(lcs.id, lc.id))
    await db.insert(lcAmendments).values({ lcId: lc.id, orderId: o.id, no: c + 1, field, oldValue: old == null ? null : String(old), newValue: String(value), reason, createdBy: actor.id })

    const [updated] = await db.select().from(lcs).where(eq(lcs.id, lc.id))
    const drafts = await db.select().from(bl).where(and(eq(bl.orderId, o.id), inArray(bl.status, ['draft', 'discrepant'])))
    for (const b of drafts) {
      const status = !config.gates.bl || blChecks(b, updated, config.commercial.blTolerance).every((x) => x.ok) ? 'draft' : 'discrepant'
      if (status !== b.status) await db.update(bl).set({ status }).where(eq(bl.id, b.id))
    }
    await record(actor, `এলসি সংশোধনী #${bn(c + 1)} লিখেছেন`, 'order', o.id, `${lc.number}: ${spec.label} — ${reason}`)
    refreshOrder(o)
    return `সংশোধনী #${bn(c + 1)} লেখা হয়েছে। বি/এল আবার মিলিয়ে দেখা হয়েছে।`
  })
}

/* ---------- bonded warehouse ---------- */

export async function bondEntry(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('bond.manage')
    const o = await loadOpenOrder(fd)
    const kind = str(fd, 'kind')
    if (kind !== 'in' && kind !== 'out') throw new Error('গ্রহণ নাকি ব্যবহার, তা বেছে নিন।')
    const material = str(fd, 'material')
    const ref = str(fd, 'ref')
    if (!material) throw new Error('কাঁচামালের নাম লিখুন।')
    if (!ref) throw new Error(kind === 'in' ? 'বিল অব এন্ট্রি বা চালান নম্বর লিখুন।' : 'ইস্যু স্লিপ নম্বর লিখুন।')
    const [u] = await db.select().from(ud).where(eq(ud.orderId, o.id))
    if (!u) throw new Error('আগে ইউডি ইস্যু করুন — ইউডি ছাড়া বন্ডে কাঁচামাল ঢোকানো যায় না।')
    const unit = unitLabel(u.permittedUnit)
    const qty = num(fd, 'qty', { min: 0.1, max: 100_000_000, label: `পরিমাণ (${unit})` })
    const on = isoDate(fd, 'on')
    if (on > today()) throw new Error('ভবিষ্যতের তারিখে হিসাব লেখা যায় না।')

    const [{ received, issued }] = await db
      .select({
        received: sql<number>`coalesce(sum(case when ${bondLedger.kind} = 'in' then ${bondLedger.qty} end), 0)::float`,
        issued: sql<number>`coalesce(sum(case when ${bondLedger.kind} = 'out' then ${bondLedger.qty} end), 0)::float`,
      })
      .from(bondLedger)
      .where(eq(bondLedger.orderId, o.id))
    if (kind === 'in' && received + qty > u.permittedQty)
      throw new Error(`ইউডিতে অনুমোদিত ${n(u.permittedQty)} ${unit}। ইতোমধ্যে ${n(received)} ${unit} এসেছে — আর ${n(Math.max(0, u.permittedQty - received))} ${unit} আনা যাবে।`)
    if (kind === 'out' && qty > received - issued) throw new Error(`বন্ডে আছে মাত্র ${n(received - issued)} ${unit}।`)

    await db.insert(bondLedger).values({ orderId: o.id, udId: u.id, kind, material, qty, unit: u.permittedUnit, ref, on, createdBy: actor.id })
    await record(actor, kind === 'in' ? 'বন্ডে কাঁচামাল গ্রহণ করেছেন' : 'বন্ড থেকে কাঁচামাল দিয়েছেন', 'order', o.id, `${o.code}: ${material} ${n(qty)} ${unit} · ${ref}`)
    refreshOrder(o)
    return kind === 'in' ? `${n(qty)} ${unit} বন্ডে গ্রহণ করা হয়েছে` : `${n(qty)} ${unit} ফ্লোরে দেওয়া হয়েছে`
  })
}

/* ---------- packing list ---------- */

export async function addCartons(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('packing.manage')
    const o = await loadOpenOrder(fd)
    await assertNoIssuedInvoice(o.id)
    const from = int(fd, 'from', { min: 1, max: 100_000, label: 'শুরুর কার্টন নং' })
    const to = int(fd, 'to', { min: 1, max: 100_000, label: 'শেষ কার্টন নং' })
    if (to < from) throw new Error('শেষ কার্টন নং শুরুর চেয়ে ছোট হতে পারে না।')
    const size = str(fd, 'size')
    if (!(size in (o.sizes ?? {}))) throw new Error('অর্ডারের একটি সাইজ বেছে নিন।')
    const pcsPerCarton = int(fd, 'pcs', { min: 1, max: 500, label: 'কার্টনপ্রতি পিস' })
    const netKg = num(fd, 'net', { min: 0.1, max: 100, label: 'নিট ওজন' })
    const grossKg = num(fd, 'gross', { min: 0.1, max: 120, label: 'গ্রস ওজন' })
    if (grossKg <= netKg) throw new Error('গ্রস ওজন নিট ওজনের চেয়ে বেশি হতে হবে।')
    const cbm = num(fd, 'cbm', { min: 0.001, max: 1, label: 'সিবিএম' })

    const rows = await db.select().from(cartons).where(eq(cartons.orderId, o.id))
    const clash = overlappingRange(rows, from, to)
    if (clash) throw new Error(`কার্টন ${bn(clash.cartonFrom)}–${bn(clash.cartonTo)} আগেই লেখা আছে।`)
    const packed = packingTotals(rows).bySize[size] ?? 0
    const adding = (to - from + 1) * pcsPerCarton
    const ordered = o.sizes[size]
    if (packed + adding > ordered * 1.05) throw new Error(`সাইজ ${size}-এর অর্ডার ${n(ordered)} পিস — ${n(packed + adding)} পিস প্যাক করা যায় না।`)

    await db.insert(cartons).values({ orderId: o.id, cartonFrom: from, cartonTo: to, size, pcsPerCarton, netKg, grossKg, cbm, createdBy: actor.id })
    await record(actor, 'প্যাকিং লিস্টে কার্টন যোগ করেছেন', 'order', o.id, `${o.code}: কার্টন ${bn(from)}–${bn(to)}, সাইজ ${size}, ${n(adding)} পিস`)
    refreshOrder(o)
    return `${bn(to - from + 1)}টি কার্টন যোগ হয়েছে`
  })
}

export async function removeCartons(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('packing.manage')
    const o = await loadOpenOrder(fd)
    await assertNoIssuedInvoice(o.id)
    const id = int(fd, 'carton_id')
    const [row] = await db.delete(cartons).where(and(eq(cartons.id, id), eq(cartons.orderId, o.id))).returning()
    if (!row) throw new Error('কার্টনের সারি পাওয়া যায়নি।')
    await record(actor, 'প্যাকিং লিস্ট থেকে কার্টন বাদ দিয়েছেন', 'order', o.id, `${o.code}: কার্টন ${bn(row.cartonFrom)}–${bn(row.cartonTo)}`)
    refreshOrder(o)
    return 'সারি বাদ দেওয়া হয়েছে'
  })
}

async function assertNoIssuedInvoice(orderId: number) {
  const [issued] = await db.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.orderId, orderId), eq(invoices.status, 'issued')))
  if (issued) throw new Error('কমার্শিয়াল ইনভয়েস ইস্যু হয়ে গেছে — প্যাকিং লিস্ট আর বদলানো যাবে না।')
}

/* ---------- commercial invoice ---------- */

async function invoiceContext(orderId: number) {
  const [master] = await db.select().from(lcs).where(and(eq(lcs.orderId, orderId), eq(lcs.kind, 'master')))
  const rows = await db.select().from(cartons).where(eq(cartons.orderId, orderId))
  const [latestBl] = await db.select().from(bl).where(eq(bl.orderId, orderId)).orderBy(desc(bl.id)).limit(1)
  return { master, packed: packingTotals(rows).pcs, blQty: latestBl?.quantity ?? null }
}

export async function saveInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('commercial.manage')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    const ctx = await invoiceContext(o.id)
    if (!ctx.packed) throw new Error('আগে প্যাকিং লিস্ট তৈরি করুন — ইনভয়েসের পরিমাণ সেখান থেকে আসে।')
    const unitPrice = num(fd, 'unit_price', { min: 0.01, max: 100_000, label: 'পিসপ্রতি দর' })
    const description = str(fd, 'description')
    if (!description) throw new Error('পণ্যের বিবরণ লিখুন।')
    const values = {
      orderId: o.id,
      issuedOn: isoDate(fd, 'issued_on'),
      quantity: ctx.packed,
      unitPrice,
      amount: Math.round(ctx.packed * unitPrice * 100) / 100,
      description,
      exp: str(fd, 'exp') || null,
      createdBy: actor.id,
    }
    const failed = invoiceChecks(values, ctx.master, ctx.packed, ctx.blQty).filter((c) => !c.ok)
    const status = failed.length ? 'discrepant' : 'draft'
    const [existing] = await db.select().from(invoices).where(and(eq(invoices.orderId, o.id), inArray(invoices.status, ['draft', 'discrepant'])))
    if (existing) await db.update(invoices).set({ ...values, status }).where(eq(invoices.id, existing.id))
    else await db.insert(invoices).values({ ...values, number: await nextCode('invoice', config.numbering), status })
    await record(actor, 'কমার্শিয়াল ইনভয়েসের খসড়া তৈরি করেছেন', 'order', o.id, `${o.code}: ${tk(values.amount)}${failed.length ? ` · ${bn(failed.length)}টি অমিল` : ''}`)
    refreshOrder(o)
    return failed.length ? `${bn(failed.length)}টি অমিল — ইস্যুর আগে ঠিক করুন` : 'ইনভয়েস এলসি, প্যাকিং লিস্ট ও বি/এল-এর সঙ্গে মিলেছে'
  })
}

export async function issueInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('commercial.manage')
    const o = await loadOpenOrder(fd)
    const id = int(fd, 'invoice_id')
    const [inv] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.orderId, o.id)))
    if (!inv) throw new Error('ইনভয়েস পাওয়া যায়নি।')
    if (inv.status === 'issued') throw new Error('ইনভয়েস আগেই ইস্যু হয়েছে।')
    const ctx = await invoiceContext(o.id)
    const failed = invoiceChecks(inv, ctx.master, ctx.packed, ctx.blQty).filter((c) => !c.ok)
    if (failed.length) throw new Error(`ইনভয়েস আটকে আছে: ${failed.map((f) => f.label).join(', ')} মেলেনি।`)
    await db.update(invoices).set({ status: 'issued' }).where(eq(invoices.id, id))
    await record(actor, 'কমার্শিয়াল ইনভয়েস ইস্যু করেছেন', 'order', o.id, `${inv.number} · ${tk(inv.amount)} · ${day(inv.issuedOn)}`)
    refreshOrder(o)
    return `${inv.number} ইস্যু হয়েছে`
  })
}

/* ---------- tech pack ---------- */

export async function readPack(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('techpack.manage')
    const o = await loadOpenOrder(fd)
    const body = str(fd, 'body')
    if (body.length < 40) throw new Error('টেক প্যাকের লেখা পেস্ট করুন — অন্তত কয়েক লাইন।')
    if (body.length > 40_000) throw new Error('টেক প্যাক অনেক বড় — মূল অংশটুকু পেস্ট করুন।')
    const { data, reader } = await readTechPack(body)
    await db.insert(techPacks).values({ orderId: o.id, body, data, reader, createdBy: actor.id })
    await record(actor, 'টেক প্যাক যোগ করেছেন', 'order', o.id, `${o.code}: ${bn(data.measurements.length)}টি মাপ, ${bn(data.trims.length)}টি ট্রিম, ${bn(data.operations.length)}টি অপারেশন`)
    refreshOrder(o)
    return reader === 'ai' ? 'এআই টেক প্যাক বিশ্লেষণ করেছে — যাচাই করে নিন' : 'এআই সাড়া দেয়নি, নিয়মভিত্তিক পদ্ধতিতে বিশ্লেষণ করা হয়েছে — ভালো করে যাচাই করুন'
  })
}

export async function addPackTrims(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('techpack.manage')
    const o = await loadOpenOrder(fd)
    const id = int(fd, 'pack_id')
    const [pack] = await db.select().from(techPacks).where(and(eq(techPacks.id, id), eq(techPacks.orderId, o.id)))
    if (!pack) throw new Error('টেক প্যাক পাওয়া যায়নি।')
    if (pack.trimsAdded) throw new Error('এই টেক প্যাকের ট্রিম আগেই যোগ হয়েছে।')
    const usable = pack.data.trims.filter((t) => t.qtyPerPc && t.qtyPerPc > 0)
    if (!usable.length) throw new Error('পিসপ্রতি পরিমাণসহ কোনো ট্রিম পাওয়া যায়নি।')
    const existing = await db.select({ material: bom.material }).from(bom).where(eq(bom.orderId, o.id))
    const have = new Set(existing.map((e) => e.material.toLowerCase()))
    const fresh = usable.filter((t) => !have.has(t.item.toLowerCase()))
    if (fresh.length)
      await db.insert(bom).values(fresh.map((t) => ({ orderId: o.id, material: t.item, kind: 'trim', qty: Math.ceil(t.qtyPerPc! * o.quantity * 1.03), unit: 'pcs', rate: 0, supplier: null, source: 'local' })))
    await db.update(techPacks).set({ trimsAdded: true }).where(eq(techPacks.id, pack.id))
    await record(actor, 'টেক প্যাক থেকে ট্রিম বিওএম-এ যোগ করেছেন', 'order', o.id, `${o.code}: ${bn(fresh.length)}টি ট্রিম`)
    refreshOrder(o)
    return fresh.length ? `${bn(fresh.length)}টি ট্রিম বিওএম-এ যোগ হয়েছে (৩% অপচয়সহ)` : 'সব ট্রিম আগে থেকেই বিওএম-এ আছে'
  })
}
