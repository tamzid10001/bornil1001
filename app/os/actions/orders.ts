'use server'

import { and, eq, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { bl, bom, defects, lays, lcs, lots, orders, sewing, tna, ud, type Order } from '@/lib/db/schema'
import { record, requireActor, requireGate } from '@/lib/actor'
import { int, isoDate, num, run, str, type ActionState } from '@/lib/action'
import { addDays, aqlPlan, DEFECT_CODES, STAGES, today, type Stage } from '@/lib/domain'
import { blChecks } from '@/lib/queries'
import { usd } from '@/lib/format'

async function loadOrder(fd: FormData) {
  const id = int(fd, 'order_id')
  const [o] = await db.select().from(orders).where(eq(orders.id, id))
  if (!o) throw new Error('Order not found.')
  if (o.closedAt) throw new Error(`${o.code} is closed.`)
  return o
}

async function advance(o: Order, to: Stage) {
  if (STAGES.indexOf(to) > STAGES.indexOf(o.stage as Stage)) {
    await db.update(orders).set({ stage: to }).where(eq(orders.id, o.id))
  }
}

async function tick(orderId: number, milestone: string) {
  await db
    .update(tna)
    .set({ doneAt: today() })
    .where(and(eq(tna.orderId, orderId), eq(tna.name, milestone)))
}

function done(o: Order) {
  revalidatePath('/os', 'layout')
  revalidatePath(`/os/orders/${o.id}`, 'layout')
}

function requireRole(role: string, allowed: string[], what: string) {
  if (role !== 'owner' && !allowed.includes(role)) throw new Error(`Only ${allowed.join(' or ')} can ${what}.`)
}

export async function commitTna(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['planner', 'merchandiser'], 'commit a critical path')
    const o = await loadOrder(fd)
    await db.update(orders).set({ tnaCommitted: true }).where(eq(orders.id, o.id))
    await record(actor, 'committed the critical path', 'order', o.id, `${o.code} ships ${o.shipDate}`)
    done(o)
    return 'critical path committed — every department now owns its dates'
  })
}

export async function toggleMilestone(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    const o = await loadOrder(fd)
    const id = int(fd, 'tna_id')
    const [m] = await db.select().from(tna).where(and(eq(tna.id, id), eq(tna.orderId, o.id)))
    if (!m) throw new Error('Milestone not found.')
    if (actor.role !== 'owner' && actor.role !== 'planner' && actor.dept !== m.ownerDept) {
      throw new Error(`${m.name} belongs to ${m.ownerDept}.`)
    }
    await db.update(tna).set({ doneAt: m.doneAt ? null : today() }).where(eq(tna.id, id))
    await record(actor, m.doneAt ? 'reopened a milestone' : 'closed a milestone', 'order', o.id, `${o.code} · ${m.name}`)
    done(o)
  })
}

export async function openMasterLc(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['commercial'], 'open a master lc')
    const o = await loadOrder(fd)
    const id = int(fd, 'lc_id')
    const bank = str(fd, 'bank')
    const discharge = str(fd, 'port_discharge')
    if (!bank || !discharge) throw new Error('Bank and port of discharge are required.')
    await db
      .update(lcs)
      .set({ status: 'opened', bank, portDischarge: discharge, latestShipment: isoDate(fd, 'latest_shipment'), openedAt: today() })
      .where(and(eq(lcs.id, id), eq(lcs.kind, 'master')))
    await tick(o.id, 'master lc received')
    await record(actor, 'recorded the master lc', 'lc', id, `${o.code} via ${bank}`)
    done(o)
  })
}

export async function requestBtb(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    const o = await loadOrder(fd)
    const lines = await db.select().from(bom).where(and(eq(bom.orderId, o.id), eq(bom.source, 'import'), eq(bom.status, 'pending')))
    const unlinked = lines.filter((l) => !l.btbId)
    if (!unlinked.length) throw new Error('Every imported material already has a btb lc.')
    const [master] = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
    const amount = unlinked.reduce((s, l) => s + l.qty * l.rate, 0)
    const number = `BTB-${o.code.replace('PO-', '')}-${String(Date.now()).slice(-3)}`
    const [btb] = await db
      .insert(lcs)
      .values({ kind: 'btb', number, orderId: o.id, masterId: master?.id ?? null, amount, tenorDays: int(fd, 'tenor_days', { min: 30, max: 180 }), bank: str(fd, 'bank') || null })
      .returning({ id: lcs.id })
    await db.update(bom).set({ btbId: btb.id }).where(inArray(bom.id, unlinked.map((l) => l.id)))
    await record(actor, 'requested a btb lc', 'lc', btb.id, `${number} · ${usd(amount)}`)
    done(o)
    return `${number} requested for ${usd(amount)}`
  })
}

export async function openBtb(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireGate('btb')
    const o = await loadOrder(fd)
    const id = int(fd, 'lc_id')
    const [btb] = await db.select().from(lcs).where(and(eq(lcs.id, id), eq(lcs.kind, 'btb')))
    if (!btb || btb.status !== 'requested') throw new Error('This btb lc is not waiting to be opened.')
    const [master] = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
    if (!master || master.status !== 'opened') throw new Error('Record the master lc first — a btb lc is opened against it.')
    const opened = await db.select().from(lcs).where(and(eq(lcs.masterId, master.id), eq(lcs.kind, 'btb'), eq(lcs.status, 'opened')))
    const used = opened.reduce((s, l) => s + l.amount, 0) + btb.amount
    if (used > master.amount * 0.75) {
      throw new Error(`btb total ${usd(used)} would exceed 75% of the master lc (${usd(master.amount * 0.75)}).`)
    }
    await db.update(lcs).set({ status: 'opened', openedAt: today(), maturity: addDays(today(), btb.tenorDays) }).where(eq(lcs.id, id))
    await tick(o.id, 'btb lc opened')
    await record(actor, 'opened a btb lc', 'lc', id, `${btb.number} · ${usd(btb.amount)} · ${btb.tenorDays} days`)
    done(o)
    return `${btb.number} opened — fabric can now be booked`
  })
}

export async function issueUd(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['commercial'], 'record a utilization declaration')
    const o = await loadOrder(fd)
    const number = str(fd, 'number')
    if (!number) throw new Error('UD number is required.')
    await db.insert(ud).values({ number, orderId: o.id, yarnPermittedKg: num(fd, 'yarn_kg', { min: 1, max: 10_000_000 }) })
    await record(actor, 'recorded a ud', 'order', o.id, `${o.code} · ${number}`)
    done(o)
  })
}

export async function bookMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['store', 'merchandiser'], 'book materials')
    const o = await loadOrder(fd)
    const id = int(fd, 'bom_id')
    const [line] = await db.select().from(bom).where(and(eq(bom.id, id), eq(bom.orderId, o.id)))
    if (!line || line.status !== 'pending') throw new Error('Nothing to book.')
    if (line.source === 'import') {
      const [btb] = line.btbId ? await db.select().from(lcs).where(eq(lcs.id, line.btbId)) : []
      if (!btb || btb.status !== 'opened') {
        throw new Error(`btb gate closed: ${line.material} is imported and needs an opened btb lc before booking.`)
      }
    }
    const supplier = str(fd, 'supplier')
    if (!supplier) throw new Error('Supplier is required.')
    await db.update(bom).set({ status: 'booked', supplier, bookedBy: actor.id, bookedAt: new Date() }).where(eq(bom.id, id))
    const rest = await db.select().from(bom).where(and(eq(bom.orderId, o.id), eq(bom.status, 'pending')))
    await tick(o.id, line.unit === 'kg' ? 'fabric booking' : 'trims booking')
    await advance(o, 'materials')
    await record(actor, 'booked material', 'order', o.id, `${o.code} · ${line.material} from ${supplier}`)
    done(o)
    return rest.length ? `${line.material} booked` : 'all materials booked'
  })
}

export async function addLay(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['cutting'], 'record a lay')
    const o = await loadOrder(fd)
    const pending = await db.select().from(bom).where(and(eq(bom.orderId, o.id), eq(bom.unit, 'kg'), eq(bom.status, 'pending')))
    if (pending.length) throw new Error('Fabric is not booked yet — nothing to cut.')
    const plies = int(fd, 'plies', { min: 1, max: 200 })
    const markerEff = num(fd, 'marker_eff', { min: 50, max: 99 })
    const totalSizes = Object.values(o.sizes).reduce((s, v) => s + v, 0) || 1
    const ratio = Object.fromEntries(Object.entries(o.sizes).map(([k, v]) => [k, Math.max(1, Math.round((v / totalSizes) * 10))]))
    const prev = await db.select().from(lays).where(eq(lays.orderId, o.id))
    const last = prev.reduce((m, l) => Math.max(m, l.bundleTo), 0)
    const bundles = Object.values(ratio).reduce((s, r) => s + r, 0)
    await db.insert(lays).values({ orderId: o.id, layNo: prev.length + 1, plies, markerEff, ratio, status: 'done', bundleFrom: last + 1, bundleTo: last + bundles })
    if (!prev.length) await tick(o.id, 'bulk cutting start')
    await advance(o, 'cut')
    await record(actor, 'recorded a lay', 'order', o.id, `${o.code} lay ${prev.length + 1} · ${plies} plies · ${markerEff}% marker`)
    done(o)
    return `lay ${prev.length + 1}: ${plies * bundles} pcs, bundles ${last + 1}–${last + bundles}`
  })
}

export async function signPp(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireGate('pp')
    const o = await loadOrder(fd)
    if (o.ppSignedAt) throw new Error('Already signed.')
    const notes = str(fd, 'notes')
    if (notes.length < 5) throw new Error('Write the pp meeting decisions — they go on the record.')
    await db.update(orders).set({ ppSignedBy: actor.id, ppSignedAt: new Date() }).where(eq(orders.id, o.id))
    await tick(o.id, 'pp meeting')
    await record(actor, 'signed the pp meeting', 'order', o.id, `${o.code}: ${notes}`)
    done(o)
    return 'pp meeting signed — bulk sewing may start'
  })
}

export async function logSewing(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['sewing', 'planner'], 'log line output')
    const o = await loadOrder(fd)
    if (!o.ppSignedAt) throw new Error('pp gate closed: quality has not signed the pp meeting. bulk output is refused.')
    const line = int(fd, 'line', { min: 1, max: 40 })
    const target = int(fd, 'target', { min: 1, max: 2000 })
    const actual = int(fd, 'actual', { min: 0, max: 2000 })
    const existing = await db.select({ id: sewing.id }).from(sewing).where(eq(sewing.orderId, o.id)).limit(1)
    await db.insert(sewing).values({ orderId: o.id, line, hourAt: new Date(), target, actual, downtimeMin: int(fd, 'downtime', { min: 0, max: 60 }), note: str(fd, 'note') || null })
    if (!existing.length) await tick(o.id, 'sewing start')
    await advance(o, 'sew')
    await record(actor, 'logged an hour', 'order', o.id, `${o.code} line ${line}: ${actual}/${target}`)
    done(o)
    return `line ${line}: ${actual} of ${target} logged`
  })
}

export async function logDefect(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    const o = await loadOrder(fd)
    const code = str(fd, 'code')
    const d = DEFECT_CODES.find((x) => x.code === code)
    if (!d) throw new Error('Choose a defect.')
    const count = int(fd, 'count', { min: 1, max: 500 })
    const line = int(fd, 'line', { min: 1, max: 40 })
    await db.insert(defects).values({ orderId: o.id, line, code, label: d.label, count })
    await record(actor, 'logged defects', 'order', o.id, `${o.code} line ${line}: ${count} × ${d.label}`)
    done(o)
    return `${count} × ${d.label} logged on line ${line}`
  })
}

export async function inspectLot(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['qa'], 'decide a final inspection')
    const o = await loadOrder(fd)
    const lotSize = int(fd, 'lot_size', { min: 2, max: 500_000 })
    const major = int(fd, 'major', { min: 0, max: 10_000 })
    const plan = aqlPlan(lotSize)
    const result = major <= plan.accept ? 'accepted' : 'rejected'
    await db.insert(lots).values({ orderId: o.id, lotSize, aql: 2.5, sample: plan.sample, major, acceptMax: plan.accept, result, decidedBy: actor.id })
    if (result === 'accepted') {
      await tick(o.id, 'sewing complete')
      await tick(o.id, 'final inspection')
      await advance(o, 'ship')
    } else {
      await advance(o, 'qc')
    }
    await record(actor, `${result} a lot`, 'order', o.id, `${o.code}: ${major} major in ${plan.sample} (accept ≤ ${plan.accept})`)
    done(o)
    return result === 'accepted' ? `accepted: ${major} ≤ ${plan.accept}` : `rejected: ${major} > ${plan.accept}. re-check and re-offer.`
  })
}

export async function saveBl(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['commercial'], 'draft a b/l')
    const o = await loadOrder(fd)
    const [master] = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
    const values = {
      orderId: o.id,
      lcId: master?.id ?? null,
      portLoading: str(fd, 'port_loading'),
      portDischarge: str(fd, 'port_discharge'),
      quantity: int(fd, 'quantity', { min: 1, max: 5_000_000 }),
      description: str(fd, 'description'),
      onBoard: isoDate(fd, 'on_board'),
    }
    if (!values.portLoading || !values.portDischarge || !values.description) throw new Error('All b/l fields are required.')
    const failed = blChecks(values, master).filter((c) => !c.ok)
    const status = failed.length ? 'discrepant' : 'draft'
    const [existing] = await db.select().from(bl).where(and(eq(bl.orderId, o.id), inArray(bl.status, ['draft', 'discrepant'])))
    if (existing) await db.update(bl).set({ ...values, status }).where(eq(bl.id, existing.id))
    else await db.insert(bl).values({ ...values, status })
    await record(actor, 'saved a b/l draft', 'order', o.id, `${o.code}: ${failed.length ? `${failed.length} discrepancies` : 'clean against the lc'}`)
    done(o)
    return failed.length ? `${failed.length} discrepanc${failed.length > 1 ? 'ies' : 'y'} against the lc — fix before release` : 'b/l matches the lc'
  })
}

export async function releaseBl(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireGate('bl')
    const o = await loadOrder(fd)
    const id = int(fd, 'bl_id')
    const [b] = await db.select().from(bl).where(and(eq(bl.id, id), eq(bl.orderId, o.id)))
    if (!b) throw new Error('B/L not found.')
    const [master] = b.lcId ? await db.select().from(lcs).where(eq(lcs.id, b.lcId)) : []
    const failed = blChecks(b, master).filter((c) => !c.ok)
    if (failed.length) throw new Error(`b/l gate closed: ${failed.map((f) => f.label).join(', ')} do not match the lc.`)
    await db.update(bl).set({ status: 'released', releasedBy: actor.id, releasedAt: new Date() }).where(eq(bl.id, id))
    await tick(o.id, 'ex-factory')
    await record(actor, 'released documents to the bank', 'order', o.id, `${o.code} b/l`)
    done(o)
    return 'documents released to the bank'
  })
}

export async function realiseOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    requireRole(actor.role, ['commercial'], 'record realisation')
    const o = await loadOrder(fd)
    const [released] = await db.select().from(bl).where(and(eq(bl.orderId, o.id), eq(bl.status, 'released')))
    if (!released) throw new Error('Release the b/l first — the bank pays against documents.')
    const values = {
      realisedAmount: num(fd, 'realised', { min: 0, max: 100_000_000 }),
      btbSettled: num(fd, 'btb_settled', { min: 0, max: 100_000_000 }),
      airFreight: num(fd, 'air_freight', { min: 0, max: 10_000_000 }),
      discount: num(fd, 'discount', { min: 0, max: 10_000_000 }),
      realisedAt: today(),
      stage: 'paid',
      closedAt: new Date(),
    }
    await db.update(orders).set(values).where(eq(orders.id, o.id))
    const btbs = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'btb'), eq(lcs.status, 'opened')))
    for (const b of btbs) await db.update(lcs).set({ settledAmount: b.amount }).where(eq(lcs.id, b.id))
    await record(actor, 'recorded realisation and closed the order', 'order', o.id, `${o.code}: ${usd(values.realisedAmount)} realised`)
    done(o)
    return 'order closed'
  })
}
