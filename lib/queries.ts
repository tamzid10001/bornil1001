import 'server-only'
import { desc, eq, isNull } from 'drizzle-orm'
import { db } from './db'
import { bl, bom, inquiries, lcs, orders, quotes, sewing, tickets, machines, tna, type Lc, type Order } from './db/schema'
import { daysBetween, quoteMargin, STAGES, today, addDays, label, MACHINE_LABEL, TNA_LABEL } from './domain'
import { bn, day, n, pct, tkK } from './format'

export type Exception = {
  kind: 'gate' | 'risk' | 'info'
  title: string
  detail: string
  href: string
  dept: string
}

export function blChecks(
  b: { portLoading: string; portDischarge: string; quantity: number; description: string; onBoard: string },
  lc: Lc | undefined,
) {
  if (!lc) return [{ label: 'মাস্টার এলসি সংযুক্ত', ok: false, expected: 'একটি খোলা মাস্টার এলসি', found: 'নেই' }]
  const tolerance = Math.round((lc.quantity ?? 0) * 0.05)
  return [
    { label: 'লোডিং বন্দর', ok: b.portLoading.toLowerCase() === (lc.portLoading ?? '').toLowerCase(), expected: lc.portLoading ?? '—', found: b.portLoading },
    { label: 'খালাস বন্দর', ok: b.portDischarge.toLowerCase() === (lc.portDischarge ?? '').toLowerCase(), expected: lc.portDischarge ?? '—', found: b.portDischarge },
    { label: 'পরিমাণ ৫%-এর মধ্যে', ok: Math.abs(b.quantity - (lc.quantity ?? 0)) <= tolerance, expected: `${n(lc.quantity)} ± ${n(tolerance)}`, found: n(b.quantity) },
    { label: 'পণ্যের বিবরণ', ok: b.description.toLowerCase() === (lc.description ?? '').toLowerCase(), expected: lc.description ?? '—', found: b.description },
    { label: 'সর্বশেষ শিপমেন্টের তারিখের মধ্যে জাহাজীকরণ', ok: !!lc.latestShipment && b.onBoard <= lc.latestShipment, expected: `≤ ${day(lc.latestShipment)}`, found: day(b.onBoard) },
  ]
}

/** Sewing pace: daily average over the last three working days and projected finish. */
export function projection(order: Order, rows: { hourAt: Date; actual: number }[]) {
  const sewn = rows.reduce((s, r) => s + r.actual, 0)
  const byDay = new Map<string, number>()
  for (const r of rows) {
    const k = new Date(r.hourAt.getTime() + 6 * 3600_000).toISOString().slice(0, 10)
    byDay.set(k, (byDay.get(k) ?? 0) + r.actual)
  }
  const t = today()
  const recent = [...byDay.entries()].filter(([k]) => k < t).sort().slice(-3)
  const pace = recent.length ? recent.reduce((s, [, v]) => s + v, 0) / recent.length : 0
  const remaining = Math.max(0, order.quantity - sewn)
  const daysNeeded = pace > 0 ? Math.ceil(remaining / pace) : null
  const finish = daysNeeded == null ? null : addDays(t, daysNeeded)
  const sewingDeadline = addDays(order.shipDate, -8)
  const late = finish != null && finish > sewingDeadline
  return { sewn, pace, remaining, finish, late, sewingDeadline }
}

export async function getExceptions(): Promise<Exception[]> {
  const t = today()
  const [allOrders, allQuotes, allBom, allLcs, allBl, allTna, openTickets, draftInquiries, allSewing] = await Promise.all([
    db.select().from(orders).where(isNull(orders.closedAt)),
    db.select().from(quotes),
    db.select().from(bom),
    db.select().from(lcs),
    db.select().from(bl),
    db.select().from(tna),
    db.select({ t: tickets, m: machines }).from(tickets).innerJoin(machines, eq(tickets.machineId, machines.id)).where(isNull(tickets.closedAt)),
    db.select().from(inquiries).where(eq(inquiries.status, 'draft')),
    db.select().from(sewing),
  ])
  const out: Exception[] = []

  for (const q of allQuotes.filter((q) => q.status === 'held')) {
    const m = quoteMargin(q)
    out.push({ kind: 'gate', dept: 'costing', title: `${q.code} কস্টিং গেটে আটকে আছে`, detail: `মার্জিন ${pct(m.pct)}, যা ন্যূনতম ${pct(q.floorMargin, 0)}-এর নিচে। মালিকের অনুমোদনের অপেক্ষায়।`, href: `/os/costing/${q.id}` })
  }

  for (const o of allOrders) {
    const pendingImport = allBom.filter((b) => b.orderId === o.id && b.source === 'import' && b.status === 'pending')
    for (const b of pendingImport) {
      const btb = allLcs.find((l) => l.id === b.btbId)
      if (!btb || btb.status !== 'opened') {
        out.push({ kind: 'gate', dept: 'store', title: `${o.code} কাপড় বুকিং আটকে আছে`, detail: `${btb ? btb.number : 'বিটুবি এলসি'} না খোলা পর্যন্ত ${b.material} বুক করা যাবে না।`, href: `/os/orders/${o.id}/materials` })
      }
    }

    const stageIdx = STAGES.indexOf(o.stage as (typeof STAGES)[number])
    if (!o.ppSignedAt && stageIdx >= STAGES.indexOf('cut')) {
      out.push({ kind: 'gate', dept: 'quality', title: `${o.code} পিপি মিটিংয়ে স্বাক্ষর হয়নি`, detail: 'মান নিয়ন্ত্রণ বিভাগ পিপি মিটিংয়ে স্বাক্ষর না করা পর্যন্ত বাল্ক সেলাইয়ের আউটপুট নেওয়া হবে না।', href: `/os/orders/${o.id}/sewing` })
    }

    for (const b of allBl.filter((b) => b.orderId === o.id && b.status !== 'released')) {
      const failed = blChecks(b, allLcs.find((l) => l.id === b.lcId)).filter((c) => !c.ok)
      if (failed.length) {
        out.push({ kind: 'gate', dept: 'commercial', title: `${o.code} বি/এল এলসির সঙ্গে মিলছে না`, detail: `${failed.map((f) => f.label).join(', ')} — কাগজপত্র আটকে রাখা হয়েছে।`, href: `/os/orders/${o.id}/shipping` })
      }
    }

    const overdue = allTna.filter((m) => m.orderId === o.id && !m.doneAt && m.dueDate < t)
    if (o.tnaCommitted && overdue.length) {
      const worst = overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
      out.push({ kind: 'risk', dept: worst.ownerDept, title: `${o.code} ${TNA_LABEL[worst.name] ?? worst.name} ${bn(daysBetween(worst.dueDate, t))} দিন পিছিয়ে`, detail: `ক্রিটিক্যাল পাথে ${bn(overdue.length)}টি মাইলস্টোনের সময় পেরিয়ে গেছে।`, href: `/os/orders/${o.id}` })
    }

    if (o.stage === 'sew') {
      const p = projection(o, allSewing.filter((s) => s.orderId === o.id))
      if (p.late && p.finish) {
        out.push({ kind: 'risk', dept: 'sewing', title: `${o.code} সেলাই শেষ হবে ${day(p.finish)}`, detail: `শিপমেন্ট ${day(o.shipDate)}-এর জন্য ${day(p.sewingDeadline)}-এর মধ্যে সেলাই শেষ করা দরকার। দৈনিক গতি ${n(p.pace)} পিস, বাকি ${n(p.remaining)} পিস।`, href: `/os/orders/${o.id}/sewing` })
      }
    }
  }

  const todayRows = allSewing.filter((s) => new Date(s.hourAt.getTime() + 6 * 3600_000).toISOString().slice(0, 10) === t)
  const lines = [...new Set(todayRows.map((r) => r.line))].sort()
  for (const line of lines) {
    const rows = todayRows.filter((r) => r.line === line)
    const eff = (rows.reduce((s, r) => s + r.actual, 0) / Math.max(1, rows.reduce((s, r) => s + r.target, 0))) * 100
    if (eff < 85) {
      out.push({ kind: 'risk', dept: 'sewing', title: `লাইন ${bn(line)} আজ লক্ষ্যের ${pct(eff, 0)}-এ`, detail: `${n(rows.reduce((s, r) => s + r.downtimeMin, 0))} মিনিট ডাউনটাইম লেখা হয়েছে।`, href: `/os/floor/${line}` })
    }
  }

  for (const { t: tk, m } of openTickets) {
    const mins = Math.round((Date.now() - tk.openedAt.getTime()) / 60000)
    out.push({ kind: 'risk', dept: 'maintenance', title: `${m.code} ${n(mins)} মিনিট ধরে বন্ধ`, detail: `লাইন ${bn(m.line)}-এর ${label(MACHINE_LABEL, m.kind)}: ${tk.issue}।`, href: '/os/maintenance' })
  }

  for (const l of allLcs.filter((l) => l.kind === 'btb' && l.status === 'opened' && l.maturity && !l.settledAmount)) {
    const left = daysBetween(t, l.maturity!)
    if (left <= 21) {
      out.push({ kind: 'risk', dept: 'commercial', title: `${l.number}-এর মেয়াদপূর্তিতে ${bn(left)} দিন বাকি`, detail: `${tkK(l.amount)} পরিশোধ করতে হবে — রপ্তানি আয় দেখে নিন।`, href: '/os/commercial' })
    }
  }

  for (const i of draftInquiries) {
    out.push({ kind: 'info', dept: 'merchandising', title: `${i.code} মার্চেন্ডাইজারের অপেক্ষায়`, detail: `${i.buyer}: ${i.subject ?? 'নতুন ইনকোয়ারি'}।`, href: `/os/inquiries/${i.id}` })
  }

  const rank = { gate: 0, risk: 1, info: 2 }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind])
}

export async function getOrder(id: number) {
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  return o ?? null
}

export async function listOrders() {
  return db.select().from(orders).orderBy(desc(orders.createdAt))
}
