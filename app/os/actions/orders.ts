'use server'

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bl, bom, defects, lays, lcs, lots, orders, sewing, tna, ud, type Order } from '@/lib/db/schema'
import { can, record, requireActor, requireGate, requirePermission } from '@/lib/actor'
import { int, isoDate, num, run, str, type ActionState } from '@/lib/action'
import { activeLine, loadOpenOrder, refreshOrder } from '@/lib/order-guard'
import { getConfig } from '@/lib/settings'
import { addDays, aqlPlan, optionLabel, STAGES, today, unitLabel, type Stage } from '@/lib/config'
import { blChecks } from '@/lib/queries'
import { bn, day, n, tk } from '@/lib/format'

async function advance(o: Order, to: Stage) {
  if (STAGES.indexOf(to) > STAGES.indexOf(o.stage as Stage)) {
    await db.update(orders).set({ stage: to }).where(eq(orders.id, o.id))
  }
}

/** Ticks a milestone the work itself proves done; keeps the first date, and is a no-op if the factory removed it from its template. */
async function tick(orderId: number, milestone: string) {
  await db
    .update(tna)
    .set({ doneAt: today() })
    .where(and(eq(tna.orderId, orderId), eq(tna.name, milestone), isNull(tna.doneAt)))
}

export async function commitTna(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('plan.manage')
    const o = await loadOpenOrder(fd)
    await db.update(orders).set({ tnaCommitted: true }).where(eq(orders.id, o.id))
    await record(actor, 'ক্রিটিক্যাল পাথ নিশ্চিত করেছেন', 'order', o.id, `${o.code} · শিপমেন্ট ${day(o.shipDate)}`)
    refreshOrder(o)
    return 'ক্রিটিক্যাল পাথ চূড়ান্ত হয়েছে — এখন থেকে প্রতিটি বিভাগ নিজ নিজ তারিখের জন্য দায়ী'
  })
}

export async function toggleMilestone(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const [actor, config] = await Promise.all([requireActor(), getConfig()])
    const o = await loadOpenOrder(fd)
    const id = int(fd, 'tna_id')
    const [m] = await db.select().from(tna).where(and(eq(tna.id, id), eq(tna.orderId, o.id)))
    if (!m) throw new Error('মাইলস্টোন পাওয়া যায়নি।')
    const name = m.label ?? m.name
    if (!can(actor, 'tna.any') && actor.dept !== m.ownerDept) {
      throw new Error(`${name} ${optionLabel(config.departments, m.ownerDept)} বিভাগের দায়িত্ব।`)
    }
    await db.update(tna).set({ doneAt: m.doneAt ? null : today() }).where(eq(tna.id, id))
    await record(actor, m.doneAt ? 'মাইলস্টোন আবার খুলেছেন' : 'মাইলস্টোন সম্পন্ন করেছেন', 'order', o.id, `${o.code} · ${name}`)
    refreshOrder(o)
  })
}

export async function openMasterLc(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('commercial.manage')
    const o = await loadOpenOrder(fd)
    const id = int(fd, 'lc_id')
    const bank = str(fd, 'bank')
    const discharge = str(fd, 'port_discharge')
    if (!bank || !discharge) throw new Error('ব্যাংক ও খালাস বন্দর দিতে হবে।')
    const [lc] = await db
      .update(lcs)
      .set({ status: 'opened', bank, portDischarge: discharge, latestShipment: isoDate(fd, 'latest_shipment'), openedAt: today() })
      .where(and(eq(lcs.id, id), eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
      .returning({ id: lcs.id })
    if (!lc) throw new Error('মাস্টার এলসি পাওয়া যায়নি।')
    await tick(o.id, 'master lc received')
    await record(actor, 'মাস্টার এলসি লিখেছেন', 'lc', id, `${o.code} · ${bank}`)
    refreshOrder(o)
  })
}

export async function requestBtb(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission(['materials.book', 'commercial.manage'])
    const o = await loadOpenOrder(fd)
    const pending = await db.select().from(bom).where(and(eq(bom.orderId, o.id), eq(bom.source, 'import'), eq(bom.status, 'pending')))
    const unlinked = pending.filter((l) => !l.btbId)
    if (!unlinked.length) throw new Error('প্রতিটি আমদানি করা কাঁচামালের বিটুবি এলসি আগেই আছে।')
    const [master] = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
    const amount = unlinked.reduce((s, l) => s + l.qty * l.rate, 0)
    const number = `BTB-${o.code.replace(/\D/g, '').slice(-5) || o.id}-${String(Date.now()).slice(-3)}`
    const [btb] = await db
      .insert(lcs)
      .values({ kind: 'btb', number, orderId: o.id, masterId: master?.id ?? null, amount, tenorDays: int(fd, 'tenor_days', { min: 30, max: 360, label: 'মেয়াদ' }), bank: str(fd, 'bank') || null })
      .returning({ id: lcs.id })
    await db.update(bom).set({ btbId: btb.id }).where(inArray(bom.id, unlinked.map((l) => l.id)))
    await record(actor, 'বিটুবি এলসির আবেদন করেছেন', 'lc', btb.id, `${number} · ${tk(amount)}`)
    refreshOrder(o)
    return `${number} — ${tk(amount)}-এর জন্য আবেদন করা হয়েছে`
  })
}

export async function openBtb(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireGate('btb')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    const id = int(fd, 'lc_id')
    const [btb] = await db.select().from(lcs).where(and(eq(lcs.id, id), eq(lcs.orderId, o.id), eq(lcs.kind, 'btb')))
    if (!btb || btb.status !== 'requested') throw new Error('এই বিটুবি এলসি খোলার অপেক্ষায় নেই।')
    const [master] = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
    if (!master || master.status !== 'opened') throw new Error('আগে মাস্টার এলসি লিখুন — বিটুবি এলসি সেটির বিপরীতেই খোলা হয়।')
    const opened = await db.select().from(lcs).where(and(eq(lcs.masterId, master.id), eq(lcs.kind, 'btb'), eq(lcs.status, 'opened')))
    const used = opened.reduce((s, l) => s + l.amount, 0) + btb.amount
    const cap = master.amount * (config.commercial.btbCap / 100)
    if (used > cap) {
      throw new Error(`বিটুবির মোট পরিমাণ ${tk(used)} হলে মাস্টার এলসির ${bn(config.commercial.btbCap)}% (${tk(cap)}) ছাড়িয়ে যাবে।`)
    }
    await db.update(lcs).set({ status: 'opened', openedAt: today(), maturity: addDays(today(), btb.tenorDays) }).where(eq(lcs.id, id))
    await tick(o.id, 'btb lc opened')
    await record(actor, 'বিটুবি এলসি খুলেছেন', 'lc', id, `${btb.number} · ${tk(btb.amount)} · ${bn(btb.tenorDays ?? 0)} দিন`)
    refreshOrder(o)
    return `${btb.number} খোলা হয়েছে — এখন কাপড় বুক করা যাবে`
  })
}

export async function issueUd(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission(['commercial.manage', 'bond.manage'])
    const o = await loadOpenOrder(fd)
    const number = str(fd, 'number')
    if (!number) throw new Error('ইউডি নম্বর দিতে হবে।')
    const material = str(fd, 'material') || 'সুতা'
    const unit = str(fd, 'unit') || 'kg'
    const qty = num(fd, 'qty', { min: 1, max: 100_000_000, label: 'অনুমোদিত পরিমাণ' })
    await db.insert(ud).values({ number, orderId: o.id, material, permittedQty: qty, permittedUnit: unit })
    await record(actor, 'ইউডি লিখেছেন', 'order', o.id, `${o.code} · ${number} · ${material} ${n(qty)} ${unitLabel(unit)}`)
    refreshOrder(o)
  })
}

export async function addBomLine(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission(['materials.book', 'techpack.manage'])
    const o = await loadOpenOrder(fd)
    const material = str(fd, 'material')
    if (!material) throw new Error('কাঁচামালের নাম লিখুন।')
    const kind = str(fd, 'kind') === 'fabric' ? 'fabric' : 'trim'
    const source = str(fd, 'source') === 'import' ? 'import' : 'local'
    const unit = str(fd, 'unit') || 'pcs'
    const qty = num(fd, 'qty', { min: 0.01, max: 100_000_000, label: 'পরিমাণ' })
    const rate = num(fd, 'rate', { min: 0, max: 10_000_000, label: 'দর' })
    await db.insert(bom).values({ orderId: o.id, material, kind, qty, unit, rate, source })
    await record(actor, 'বিওএম-এ কাঁচামাল যোগ করেছেন', 'order', o.id, `${o.code} · ${material} ${n(qty)} ${unitLabel(unit)}`)
    refreshOrder(o)
    return `${material} বিওএম-এ যোগ হয়েছে`
  })
}

export async function bookMaterial(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('materials.book')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    const id = int(fd, 'bom_id')
    const [line] = await db.select().from(bom).where(and(eq(bom.id, id), eq(bom.orderId, o.id)))
    if (!line || line.status !== 'pending') throw new Error('বুক করার কিছু নেই।')
    if (config.gates.btb && line.source === 'import') {
      const [btb] = line.btbId ? await db.select().from(lcs).where(eq(lcs.id, line.btbId)) : []
      if (!btb || btb.status !== 'opened') {
        throw new Error(`বিটুবি গেট বন্ধ: ${line.material} আমদানি করা পণ্য — বুক করার আগে বিটুবি এলসি খুলতে হবে।`)
      }
    }
    const supplier = str(fd, 'supplier')
    if (!supplier) throw new Error('সরবরাহকারীর নাম দিতে হবে।')
    await db.update(bom).set({ status: 'booked', supplier, bookedBy: actor.id, bookedAt: new Date() }).where(eq(bom.id, id))
    const rest = await db.select({ id: bom.id }).from(bom).where(and(eq(bom.orderId, o.id), eq(bom.status, 'pending')))
    await tick(o.id, line.kind === 'fabric' ? 'fabric booking' : 'trims booking')
    await advance(o, 'materials')
    await record(actor, 'কাঁচামাল বুক করেছেন', 'order', o.id, `${o.code} · ${line.material} · ${supplier}`)
    refreshOrder(o)
    return rest.length ? `${line.material} বুক করা হয়েছে` : 'সব কাঁচামাল বুক করা হয়েছে'
  })
}

export async function addLay(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('cutting.record')
    const o = await loadOpenOrder(fd)
    const pending = await db.select({ id: bom.id }).from(bom).where(and(eq(bom.orderId, o.id), eq(bom.kind, 'fabric'), eq(bom.status, 'pending')))
    if (pending.length) throw new Error('কাপড় এখনো বুক হয়নি — কাটার কিছু নেই।')
    const plies = int(fd, 'plies', { min: 1, max: 500, label: 'প্লাই' })
    const markerEff = num(fd, 'marker_eff', { min: 50, max: 99, label: 'মার্কার দক্ষতা' })
    const totalSizes = Object.values(o.sizes).reduce((s, v) => s + v, 0) || 1
    const ratio = Object.fromEntries(Object.entries(o.sizes).map(([k, v]) => [k, Math.max(1, Math.round((v / totalSizes) * 10))]))
    const prev = await db.select().from(lays).where(eq(lays.orderId, o.id))
    const last = prev.reduce((m, l) => Math.max(m, l.bundleTo), 0)
    const bundles = Object.values(ratio).reduce((s, r) => s + r, 0)
    await db.insert(lays).values({ orderId: o.id, layNo: prev.length + 1, plies, markerEff, ratio, status: 'done', bundleFrom: last + 1, bundleTo: last + bundles })
    if (!prev.length) await tick(o.id, 'bulk cutting start')
    await advance(o, 'cut')
    await record(actor, 'লে লিখেছেন', 'order', o.id, `${o.code} লে ${bn(prev.length + 1)} · ${bn(plies)} প্লাই · ${bn(markerEff)}% মার্কার`)
    refreshOrder(o)
    return `লে ${n(prev.length + 1)}: ${n(plies * bundles)} পিস, বান্ডেল ${n(last + 1)}–${n(last + bundles)}`
  })
}

export async function signPp(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireGate('pp')
    const o = await loadOpenOrder(fd)
    if (o.ppSignedAt) throw new Error('আগেই স্বাক্ষর করা হয়েছে।')
    const notes = str(fd, 'notes')
    if (notes.length < 5) throw new Error('পিপি মিটিংয়ের সিদ্ধান্ত লিখুন — এগুলো রেকর্ডে থাকবে।')
    await db.update(orders).set({ ppSignedBy: actor.id, ppSignedAt: new Date() }).where(eq(orders.id, o.id))
    await tick(o.id, 'pp meeting')
    await record(actor, 'পিপি মিটিংয়ে স্বাক্ষর করেছেন', 'order', o.id, `${o.code}: ${notes}`)
    refreshOrder(o)
    return 'পিপি মিটিংয়ে স্বাক্ষর হয়েছে — এখন বাল্ক সেলাই শুরু করা যাবে'
  })
}

export async function logSewing(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('sewing.record')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    if (config.gates.pp && !o.ppSignedAt) throw new Error('পিপি গেট বন্ধ: মান নিয়ন্ত্রণ বিভাগ পিপি মিটিংয়ে স্বাক্ষর করেনি, তাই বাল্ক আউটপুট নেওয়া হবে না।')
    const line = await activeLine(fd)
    const target = int(fd, 'target', { min: 1, max: 10_000, label: 'লক্ষ্য' })
    const actual = int(fd, 'actual', { min: 0, max: 10_000, label: 'আউটপুট' })
    const existing = await db.select({ id: sewing.id }).from(sewing).where(eq(sewing.orderId, o.id)).limit(1)
    await db.insert(sewing).values({ orderId: o.id, line: line.id, hourAt: new Date(), target, actual, downtimeMin: int(fd, 'downtime', { min: 0, max: 60, label: 'ডাউনটাইম' }), note: str(fd, 'note') || null })
    if (!existing.length) await tick(o.id, 'sewing start')
    await advance(o, 'sew')
    await record(actor, 'এক ঘণ্টার হিসাব লিখেছেন', 'order', o.id, `${o.code} ${line.name}: ${bn(actual)}/${bn(target)}`)
    refreshOrder(o)
    return `${line.name}: লক্ষ্য ${n(target)}-এর মধ্যে ${n(actual)} পিস লেখা হয়েছে`
  })
}

export async function logDefect(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('quality.record')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    const code = str(fd, 'code')
    const d = config.defects.find((x) => x.code === code)
    if (!d) throw new Error('একটি ত্রুটি বেছে নিন।')
    const count = int(fd, 'count', { min: 1, max: 5000, label: 'সংখ্যা' })
    const line = await activeLine(fd)
    await db.insert(defects).values({ orderId: o.id, line: line.id, code, label: d.label, count })
    await record(actor, 'ত্রুটি লিখেছেন', 'order', o.id, `${o.code} ${line.name}: ${bn(count)} × ${d.label}`)
    refreshOrder(o)
    return `${line.name}-এ ${n(count)} × ${d.label} লেখা হয়েছে`
  })
}

export async function inspectLot(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('quality.inspect')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    const lotSize = int(fd, 'lot_size', { min: 2, max: 5_000_000, label: 'লটের আকার' })
    const major = int(fd, 'major', { min: 0, max: 10_000, label: 'মেজর ত্রুটি' })
    const { level, aql } = config.quality
    const plan = aqlPlan(lotSize, level, aql)
    const result = major <= plan.accept ? 'accepted' : 'rejected'
    await db.insert(lots).values({ orderId: o.id, lotSize, aql, level, sample: plan.sample, major, acceptMax: plan.accept, result, decidedBy: actor.id })
    if (result === 'accepted') {
      await tick(o.id, 'sewing complete')
      await tick(o.id, 'final inspection')
      await advance(o, 'ship')
    } else {
      await advance(o, 'qc')
    }
    await record(actor, result === 'accepted' ? 'লট গ্রহণ করেছেন' : 'লট প্রত্যাখ্যান করেছেন', 'order', o.id, `${o.code}: ${bn(plan.sample)}টি নমুনায় ${bn(major)}টি মেজর ত্রুটি (গ্রহণযোগ্য ≤ ${bn(plan.accept)})`)
    refreshOrder(o)
    return result === 'accepted' ? `লট গৃহীত: ${bn(major)} ≤ ${bn(plan.accept)}` : `লট প্রত্যাখ্যাত: ${bn(major)} > ${bn(plan.accept)}। আবার যাচাই করে নতুন করে দিন।`
  })
}

export async function saveBl(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('commercial.manage')
    const config = await getConfig()
    const o = await loadOpenOrder(fd)
    const [master] = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'master')))
    const values = {
      orderId: o.id,
      lcId: master?.id ?? null,
      portLoading: str(fd, 'port_loading'),
      portDischarge: str(fd, 'port_discharge'),
      quantity: int(fd, 'quantity', { min: 1, max: 10_000_000, label: 'পরিমাণ' }),
      description: str(fd, 'description'),
      onBoard: isoDate(fd, 'on_board'),
    }
    if (!values.portLoading || !values.portDischarge || !values.description) throw new Error('বি/এল-এর সব তথ্য দিতে হবে।')
    const failed = config.gates.bl ? blChecks(values, master, config.commercial.blTolerance).filter((c) => !c.ok) : []
    const status = failed.length ? 'discrepant' : 'draft'
    const [existing] = await db.select().from(bl).where(and(eq(bl.orderId, o.id), inArray(bl.status, ['draft', 'discrepant'])))
    if (existing) await db.update(bl).set({ ...values, status }).where(eq(bl.id, existing.id))
    else await db.insert(bl).values({ ...values, status })
    if (values.onBoard <= today()) await tick(o.id, 'ex-factory')
    await record(actor, 'বি/এল খসড়া সংরক্ষণ করেছেন', 'order', o.id, `${o.code}: ${failed.length ? `${bn(failed.length)}টি অমিল` : 'সব তথ্য মিলেছে'}`)
    refreshOrder(o)
    return failed.length ? `এলসির সঙ্গে ${bn(failed.length)}টি অমিল — পাঠানোর আগে ঠিক করুন` : 'বি/এল সংরক্ষণ করা হয়েছে'
  })
}

export async function releaseBl(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const config = await getConfig()
    const actor = config.gates.bl ? await requireGate('bl') : await requirePermission('commercial.manage')
    const o = await loadOpenOrder(fd)
    const id = int(fd, 'bl_id')
    const [b] = await db.select().from(bl).where(and(eq(bl.id, id), eq(bl.orderId, o.id)))
    if (!b) throw new Error('বি/এল পাওয়া যায়নি।')
    if (config.gates.bl) {
      const [master] = b.lcId ? await db.select().from(lcs).where(eq(lcs.id, b.lcId)) : []
      const failed = blChecks(b, master, config.commercial.blTolerance).filter((c) => !c.ok)
      if (failed.length) throw new Error(`বি/এল গেট বন্ধ: ${failed.map((f) => f.label).join(', ')} এলসির সঙ্গে মেলেনি।`)
    }
    await db.update(bl).set({ status: 'released', releasedBy: actor.id, releasedAt: new Date() }).where(eq(bl.id, id))
    await tick(o.id, 'ex-factory')
    await tick(o.id, 'documents to bank')
    await record(actor, 'কাগজপত্র ব্যাংকে পাঠিয়েছেন', 'order', o.id, `${o.code} বি/এল`)
    refreshOrder(o)
    return 'কাগজপত্র পাঠানো হয়েছে'
  })
}

export async function realiseOrder(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('commercial.manage')
    const o = await loadOpenOrder(fd)
    const [released] = await db.select({ id: bl.id }).from(bl).where(and(eq(bl.orderId, o.id), eq(bl.status, 'released')))
    if (!released) throw new Error('আগে বি/এল পাঠান — ক্রেতা বা ব্যাংক কাগজপত্রের বিপরীতেই টাকা দেয়।')
    const { commercial } = await getConfig()
    const realisedAmount = num(fd, 'realised', { min: 0, max: 10_000_000_000, label: 'প্রাপ্ত টাকা' })
    const values = {
      realisedAmount,
      sourceTax: Math.round(realisedAmount * commercial.sourceTaxPct) / 100,
      centralFund: Math.round(realisedAmount * commercial.centralFundPct) / 100,
      btbSettled: num(fd, 'btb_settled', { min: 0, max: 10_000_000_000, label: 'বিটুবি পরিশোধ' }),
      airFreight: num(fd, 'air_freight', { min: 0, max: 1_000_000_000, label: 'এয়ার ফ্রেইট' }),
      discount: num(fd, 'discount', { min: 0, max: 1_000_000_000, label: 'ছাড়' }),
      realisedAt: today(),
      stage: 'paid',
      closedAt: new Date(),
    }
    await db.update(orders).set(values).where(eq(orders.id, o.id))
    const btbs = await db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'btb'), eq(lcs.status, 'opened')))
    for (const b of btbs) await db.update(lcs).set({ settledAmount: b.amount }).where(eq(lcs.id, b.id))
    await record(actor, 'টাকা প্রাপ্তি লিখে অর্ডার বন্ধ করেছেন', 'order', o.id, `${o.code}: ${tk(values.realisedAmount)} প্রাপ্ত`)
    refreshOrder(o)
    return 'অর্ডার বন্ধ করা হয়েছে'
  })
}
