import 'server-only'
import { desc, eq, isNull } from 'drizzle-orm'
import { db } from './db'
import { bl, bom, inquiries, lcs, orders, quotes, sewing, tickets, machines, tna, type Lc, type Order } from './db/schema'
import { addDays, daysBetween, lineName, optionLabel, STAGES, today } from './config'
import { quoteMargin } from './domain'
import { getConfig, getFloorPlan } from './settings'
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
  tolerancePct = 5,
) {
  if (!lc) return [{ label: 'মাস্টার এলসি সংযুক্ত', ok: false, expected: 'একটি খোলা মাস্টার এলসি', found: 'নেই' }]
  const tolerance = Math.round(((lc.quantity ?? 0) * tolerancePct) / 100)
  return [
    { label: 'লোডিং বন্দর', ok: b.portLoading.toLowerCase() === (lc.portLoading ?? '').toLowerCase(), expected: lc.portLoading ?? '—', found: b.portLoading },
    { label: 'খালাস বন্দর', ok: b.portDischarge.toLowerCase() === (lc.portDischarge ?? '').toLowerCase(), expected: lc.portDischarge ?? '—', found: b.portDischarge },
    { label: `পরিমাণ ${bn(tolerancePct)}%-এর মধ্যে`, ok: Math.abs(b.quantity - (lc.quantity ?? 0)) <= tolerance, expected: `${n(lc.quantity)} ± ${n(tolerance)}`, found: n(b.quantity) },
    { label: 'পণ্যের বিবরণ', ok: b.description.toLowerCase() === (lc.description ?? '').toLowerCase(), expected: lc.description ?? '—', found: b.description },
    { label: 'সর্বশেষ শিপমেন্টের তারিখের মধ্যে জাহাজীকরণ', ok: !!lc.latestShipment && b.onBoard <= lc.latestShipment, expected: `≤ ${day(lc.latestShipment)}`, found: day(b.onBoard) },
  ]
}

const dhakaDay = (d: Date) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10)

/** Sewing pace: daily average over the last three working days and projected finish. */
export function projection(order: Order, rows: { hourAt: Date; actual: number }[], bufferDays = 8) {
  const sewn = rows.reduce((s, r) => s + r.actual, 0)
  const byDay = new Map<string, number>()
  for (const r of rows) byDay.set(dhakaDay(r.hourAt), (byDay.get(dhakaDay(r.hourAt)) ?? 0) + r.actual)
  const t = today()
  const recent = [...byDay.entries()].filter(([k]) => k < t).sort().slice(-3)
  const pace = recent.length ? recent.reduce((s, [, v]) => s + v, 0) / recent.length : 0
  const remaining = Math.max(0, order.quantity - sewn)
  const daysNeeded = pace > 0 ? Math.ceil(remaining / pace) : null
  const finish = daysNeeded == null ? null : addDays(t, daysNeeded)
  const sewingDeadline = addDays(order.shipDate, -bufferDays)
  const late = finish != null && finish > sewingDeadline
  return { sewn, pace, remaining, finish, late, sewingDeadline }
}

export async function getExceptions(): Promise<Exception[]> {
  const t = today()
  const [config, plan, allOrders, allQuotes, allBom, allLcs, allBl, allTna, openTickets, draftInquiries, allSewing] = await Promise.all([
    getConfig(),
    getFloorPlan(),
    db.select().from(orders).where(isNull(orders.closedAt)),
    db.select().from(quotes).where(eq(quotes.status, 'held')),
    db.select().from(bom).where(eq(bom.status, 'pending')),
    db.select().from(lcs),
    db.select().from(bl),
    db.select().from(tna).where(isNull(tna.doneAt)),
    db.select({ t: tickets, m: machines }).from(tickets).innerJoin(machines, eq(tickets.machineId, machines.id)).where(isNull(tickets.closedAt)),
    db.select().from(inquiries).where(eq(inquiries.status, 'draft')),
    db.select().from(sewing),
  ])
  const { gates, modules, production, commercial } = config
  const out: Exception[] = []

  if (gates.costing) {
    for (const q of allQuotes) {
      const m = quoteMargin(q)
      out.push({ kind: 'gate', dept: 'costing', title: `${q.code} কস্টিং গেটে আটকে আছে`, detail: `মার্জিন ${pct(m.pct)}, যা ন্যূনতম ${pct(q.floorMargin, 0)}-এর নিচে। অনুমোদনের অপেক্ষায়।`, href: `/os/costing/${q.id}` })
    }
  }

  for (const o of allOrders) {
    if (gates.btb) {
      for (const b of allBom.filter((b) => b.orderId === o.id && b.source === 'import')) {
        const btb = allLcs.find((l) => l.id === b.btbId)
        if (!btb || btb.status !== 'opened') {
          out.push({ kind: 'gate', dept: 'store', title: `${o.code} কাঁচামাল বুকিং আটকে আছে`, detail: `${btb ? btb.number : 'বিটুবি এলসি'} না খোলা পর্যন্ত ${b.material} বুক করা যাবে না।`, href: `/os/orders/${o.id}/materials` })
        }
      }
    }

    const stageIdx = STAGES.indexOf(o.stage as (typeof STAGES)[number])
    if (gates.pp && !o.ppSignedAt && stageIdx >= STAGES.indexOf('cut')) {
      out.push({ kind: 'gate', dept: 'quality', title: `${o.code} পিপি মিটিংয়ে স্বাক্ষর হয়নি`, detail: 'মান নিয়ন্ত্রণ বিভাগ পিপি মিটিংয়ে স্বাক্ষর না করা পর্যন্ত বাল্ক সেলাইয়ের আউটপুট নেওয়া হবে না।', href: `/os/orders/${o.id}/sewing` })
    }

    if (gates.bl) {
      for (const b of allBl.filter((b) => b.orderId === o.id && b.status !== 'released')) {
        const failed = blChecks(b, allLcs.find((l) => l.id === b.lcId), commercial.blTolerance).filter((c) => !c.ok)
        if (failed.length) {
          out.push({ kind: 'gate', dept: 'commercial', title: `${o.code} বি/এল এলসির সঙ্গে মিলছে না`, detail: `${failed.map((f) => f.label).join(', ')} — কাগজপত্র আটকে রাখা হয়েছে।`, href: `/os/orders/${o.id}/shipping` })
        }
      }
    }

    if (modules.commercial) {
      const shipped = allBl.filter((b) => b.orderId === o.id && b.onBoard <= t).sort((a, b) => a.onBoard.localeCompare(b.onBoard))
      const unsent = shipped.find((b) => b.status !== 'released')
      const sent = shipped.find((b) => b.status === 'released')
      const deadlines = [
        unsent && { b: unsent, days: commercial.presentationDays, warn: 7, what: 'কাগজপত্র ব্যাংকে জমার', href: `/os/orders/${o.id}/shipping` },
        sent && { b: sent, days: commercial.realisationDays, warn: 30, what: 'রপ্তানি আয় দেশে আনার', href: `/os/orders/${o.id}` },
      ]
      for (const d of deadlines) {
        if (!d) continue
        const due = addDays(d.b.onBoard, d.days)
        const left = daysBetween(t, due)
        if (left > d.warn) continue
        out.push({
          kind: 'risk',
          dept: 'commercial',
          title: left < 0 ? `${o.code} ${d.what} সময় ${bn(-left)} দিন পেরিয়েছে` : `${o.code} ${d.what} আর ${bn(left)} দিন বাকি`,
          detail: `জাহাজীকরণ ${day(d.b.onBoard)} · শেষ দিন ${day(due)}`,
          href: d.href,
        })
      }
    }

    const overdue = allTna.filter((m) => m.orderId === o.id && m.dueDate < t)
    if (o.tnaCommitted && overdue.length) {
      const worst = overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
      out.push({ kind: 'risk', dept: worst.ownerDept, title: `${o.code} ${worst.label ?? worst.name} ${bn(daysBetween(worst.dueDate, t))} দিন পিছিয়ে`, detail: `ক্রিটিক্যাল পাথে ${bn(overdue.length)}টি মাইলস্টোনের সময় পেরিয়ে গেছে।`, href: `/os/orders/${o.id}` })
    }

    if (o.stage === 'sew') {
      const p = projection(o, allSewing.filter((s) => s.orderId === o.id), production.shipBufferDays)
      if (p.late && p.finish) {
        out.push({ kind: 'risk', dept: 'sewing', title: `${o.code} সেলাই শেষ হবে ${day(p.finish)}`, detail: `শিপমেন্ট ${day(o.shipDate)}-এর জন্য ${day(p.sewingDeadline)}-এর মধ্যে সেলাই শেষ করা দরকার। দৈনিক গতি ${n(p.pace)} পিস, বাকি ${n(p.remaining)} পিস।`, href: `/os/orders/${o.id}/sewing` })
      }
    }
  }

  const todayRows = allSewing.filter((s) => dhakaDay(s.hourAt) === t)
  for (const line of [...new Set(todayRows.map((r) => r.line))].sort((a, b) => a - b)) {
    const rows = todayRows.filter((r) => r.line === line)
    const eff = (rows.reduce((s, r) => s + r.actual, 0) / Math.max(1, rows.reduce((s, r) => s + r.target, 0))) * 100
    if (eff < production.efficiencyAlert) {
      out.push({ kind: 'risk', dept: 'sewing', title: `${lineName(plan.lines, line)} আজ লক্ষ্যের ${pct(eff, 0)}-এ`, detail: `${n(rows.reduce((s, r) => s + r.downtimeMin, 0))} মিনিট ডাউনটাইম লেখা হয়েছে।`, href: `/os/floor#line-${line}` })
    }
  }

  if (modules.maintenance) {
    for (const { t: tk, m } of openTickets) {
      const mins = Math.round((Date.now() - tk.openedAt.getTime()) / 60000)
      const where = m.line ? `${lineName(plan.lines, m.line)}-এর ` : ''
      out.push({ kind: 'risk', dept: 'maintenance', title: `${m.code} ${n(mins)} মিনিট ধরে বন্ধ`, detail: `${where}${optionLabel(config.machineTypes, m.kind)}: ${tk.issue}।`, href: '/os/maintenance' })
    }
  }

  if (modules.commercial) {
    for (const l of allLcs.filter((l) => l.kind === 'btb' && l.status === 'opened' && l.maturity && !l.settledAmount)) {
      const left = daysBetween(t, l.maturity!)
      if (left <= 21) {
        out.push({ kind: 'risk', dept: 'commercial', title: `${l.number}-এর মেয়াদপূর্তিতে ${bn(left)} দিন বাকি`, detail: `${tkK(l.amount)} পরিশোধ করতে হবে — রপ্তানি আয় দেখে নিন।`, href: '/os/commercial' })
      }
    }
  }

  if (modules.inquiries) {
    for (const i of draftInquiries) {
      out.push({ kind: 'info', dept: 'merchandising', title: `${i.code} মার্চেন্ডাইজারের অপেক্ষায়`, detail: `${i.buyer}: ${i.subject ?? 'নতুন ইনকোয়ারি'}।`, href: `/os/inquiries/${i.id}` })
    }
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
