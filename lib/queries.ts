import 'server-only'
import { desc, eq, isNull } from 'drizzle-orm'
import { db } from './db'
import { bl, bom, inquiries, lcs, orders, quotes, sewing, tickets, machines, tna, type Lc, type Order } from './db/schema'
import { daysBetween, quoteMargin, STAGES, today, addDays } from './domain'
import { day, pct } from './format'

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
  if (!lc) return [{ label: 'master lc linked', ok: false, expected: 'an opened master lc', found: 'none' }]
  const tolerance = Math.round((lc.quantity ?? 0) * 0.05)
  return [
    { label: 'port of loading', ok: b.portLoading.toLowerCase() === (lc.portLoading ?? '').toLowerCase(), expected: lc.portLoading ?? '—', found: b.portLoading },
    { label: 'port of discharge', ok: b.portDischarge.toLowerCase() === (lc.portDischarge ?? '').toLowerCase(), expected: lc.portDischarge ?? '—', found: b.portDischarge },
    { label: 'quantity within 5%', ok: Math.abs(b.quantity - (lc.quantity ?? 0)) <= tolerance, expected: `${lc.quantity} ± ${tolerance}`, found: String(b.quantity) },
    { label: 'goods description', ok: b.description.toLowerCase() === (lc.description ?? '').toLowerCase(), expected: lc.description ?? '—', found: b.description },
    { label: 'on board by latest shipment', ok: !!lc.latestShipment && b.onBoard <= lc.latestShipment, expected: `≤ ${day(lc.latestShipment)}`, found: day(b.onBoard) },
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
    out.push({ kind: 'gate', dept: 'costing', title: `${q.code} held at the costing gate`, detail: `margin ${pct(m.pct)} is under the ${pct(q.floorMargin, 0)} floor. waiting for the owner.`, href: `/os/costing/${q.id}` })
  }

  for (const o of allOrders) {
    const pendingImport = allBom.filter((b) => b.orderId === o.id && b.source === 'import' && b.status === 'pending')
    for (const b of pendingImport) {
      const btb = allLcs.find((l) => l.id === b.btbId)
      if (!btb || btb.status !== 'opened') {
        out.push({ kind: 'gate', dept: 'store', title: `${o.code} fabric booking blocked`, detail: `${b.material} cannot be booked until ${btb ? btb.number : 'a btb lc'} is opened.`, href: `/os/orders/${o.id}/materials` })
      }
    }

    const stageIdx = STAGES.indexOf(o.stage as (typeof STAGES)[number])
    if (!o.ppSignedAt && stageIdx >= STAGES.indexOf('cut')) {
      out.push({ kind: 'gate', dept: 'quality', title: `${o.code} pp meeting not signed`, detail: 'bulk sewing output is refused until quality signs the pp meeting.', href: `/os/orders/${o.id}/sewing` })
    }

    for (const b of allBl.filter((b) => b.orderId === o.id && b.status !== 'released')) {
      const failed = blChecks(b, allLcs.find((l) => l.id === b.lcId)).filter((c) => !c.ok)
      if (failed.length) {
        out.push({ kind: 'gate', dept: 'commercial', title: `${o.code} b/l does not match the lc`, detail: `${failed.map((f) => f.label).join(', ')} — documents held.`, href: `/os/orders/${o.id}/shipping` })
      }
    }

    const overdue = allTna.filter((m) => m.orderId === o.id && !m.doneAt && m.dueDate < t)
    if (o.tnaCommitted && overdue.length) {
      const worst = overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
      out.push({ kind: 'risk', dept: worst.ownerDept, title: `${o.code} ${worst.name} is ${daysBetween(worst.dueDate, t)} days late`, detail: `${overdue.length} milestone${overdue.length > 1 ? 's' : ''} past due on the critical path.`, href: `/os/orders/${o.id}` })
    }

    if (o.stage === 'sew') {
      const p = projection(o, allSewing.filter((s) => s.orderId === o.id))
      if (p.late && p.finish) {
        out.push({ kind: 'risk', dept: 'sewing', title: `${o.code} will finish sewing ${day(p.finish)}`, detail: `needed by ${day(p.sewingDeadline)} for ship ${day(o.shipDate)}. pace ${Math.round(p.pace)} pcs/day, ${p.remaining} to go.`, href: `/os/orders/${o.id}/sewing` })
      }
    }
  }

  const todayRows = allSewing.filter((s) => new Date(s.hourAt.getTime() + 6 * 3600_000).toISOString().slice(0, 10) === t)
  const lines = [...new Set(todayRows.map((r) => r.line))].sort()
  for (const line of lines) {
    const rows = todayRows.filter((r) => r.line === line)
    const eff = (rows.reduce((s, r) => s + r.actual, 0) / Math.max(1, rows.reduce((s, r) => s + r.target, 0))) * 100
    if (eff < 85) {
      out.push({ kind: 'risk', dept: 'sewing', title: `line ${line} at ${pct(eff, 0)} of target today`, detail: `${rows.reduce((s, r) => s + r.downtimeMin, 0)} min downtime logged.`, href: `/os/floor/${line}` })
    }
  }

  for (const { t: tk, m } of openTickets) {
    const mins = Math.round((Date.now() - tk.openedAt.getTime()) / 60000)
    out.push({ kind: 'risk', dept: 'maintenance', title: `${m.code} down for ${mins} min`, detail: `${m.kind} on line ${m.line}: ${tk.issue}.`, href: '/os/maintenance' })
  }

  for (const l of allLcs.filter((l) => l.kind === 'btb' && l.status === 'opened' && l.maturity && !l.settledAmount)) {
    const left = daysBetween(t, l.maturity!)
    if (left <= 21) {
      out.push({ kind: 'risk', dept: 'commercial', title: `${l.number} matures in ${left} days`, detail: `$${Math.round(l.amount).toLocaleString('en-US')} to settle — check export proceeds.`, href: '/os/commercial' })
    }
  }

  for (const i of draftInquiries) {
    out.push({ kind: 'info', dept: 'merchandising', title: `${i.code} waiting for a merchandiser`, detail: `${i.buyer}: ${i.subject ?? 'new inquiry'}.`, href: `/os/inquiries/${i.id}` })
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
