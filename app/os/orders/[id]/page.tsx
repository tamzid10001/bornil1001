import { notFound } from 'next/navigation'
import { asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bl, bom, bondLedger, cartons, defects, invoices, lays, lcAmendments, lcs, lots, people, sewing, techPacks, tna, ud } from '@/lib/db/schema'
import { TechPackSection } from '@/components/os/order/techpack'
import { BondSection } from '@/components/os/order/bond'
import { ExportDocsSection } from '@/components/os/order/docs'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig, getFloorPlan } from '@/lib/settings'
import { optionLabel } from '@/lib/config'
import { getOrder, projection } from '@/lib/queries'
import { day, n, tkK } from '@/lib/format'
import { Chip, PageHeader, StageRail, Stat } from '@/components/os/ui'
import { PlanSection } from '@/components/os/order/plan'
import { MoneyIn } from '@/components/os/order/commercial'
import { MaterialsSection } from '@/components/os/order/materials'
import { ProductionSection } from '@/components/os/order/production'
import { ShipSection } from '@/components/os/order/ship'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const orderId = Number(id)
  if (!Number.isInteger(orderId) || orderId <= 0) notFound()
  const o = await getOrder(orderId)
  if (!o) notFound()

  const [actor, config, plan, staff, milestones, orderLcs, orderUd, materials, orderLays, orderSewing, orderDefects, orderLots, bls, amendments, bond, packed, invs, packs] = await Promise.all([
    getActor(),
    getConfig(),
    getFloorPlan(),
    db.select().from(people),
    db.select().from(tna).where(eq(tna.orderId, o.id)).orderBy(asc(tna.sort)),
    db.select().from(lcs).where(eq(lcs.orderId, o.id)),
    db.select().from(ud).where(eq(ud.orderId, o.id)),
    db.select().from(bom).where(eq(bom.orderId, o.id)).orderBy(asc(bom.id)),
    db.select().from(lays).where(eq(lays.orderId, o.id)).orderBy(asc(lays.layNo)),
    db.select().from(sewing).where(eq(sewing.orderId, o.id)),
    db.select().from(defects).where(eq(defects.orderId, o.id)),
    db.select().from(lots).where(eq(lots.orderId, o.id)),
    db.select().from(bl).where(eq(bl.orderId, o.id)),
    db.select().from(lcAmendments).where(eq(lcAmendments.orderId, o.id)).orderBy(asc(lcAmendments.no)),
    db.select().from(bondLedger).where(eq(bondLedger.orderId, o.id)).orderBy(asc(bondLedger.on), asc(bondLedger.id)),
    db.select().from(cartons).where(eq(cartons.orderId, o.id)).orderBy(asc(cartons.cartonFrom)),
    db.select().from(invoices).where(eq(invoices.orderId, o.id)).orderBy(desc(invoices.id)).limit(1),
    db.select().from(techPacks).where(eq(techPacks.orderId, o.id)).orderBy(desc(techPacks.id)).limit(1),
  ])
  const can = grantsFor(actor)
  const latestBl = [...bls].sort((a, b) => b.id - a.id)[0]
  const nameOf = (pid: number | null) => staff.find((p) => p.id === pid)?.name ?? '—'
  const p = projection(o, orderSewing, config.production.shipBufferDays)
  const master = orderLcs.find((l) => l.kind === 'master')
  const cut = orderLays.reduce((s, l) => s + l.plies * Object.values(l.ratio).reduce((a, b) => a + b, 0), 0)
  const category = optionLabel(config.categories, o.category)

  return (
    <>
      <PageHeader
        eyebrow={`${o.buyer} · ${category} · শিপমেন্ট ${day(o.shipDate)}`}
        title={`${o.code} — ${o.style}`}
        lede={`${o.fabric ?? 'কাপড় নির্ধারিত হয়নি'} · ${Object.entries(o.sizes).map(([k, v]) => `${k} ${n(v)}`).join(' · ')}`}
        actions={o.closedAt ? <Chip status="closed" /> : p.late ? <Chip status="late">দেরির আশঙ্কা</Chip> : null}
      />
      <StageRail stage={o.stage} labels={config.stages} />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={tkK(o.quantity * o.fob)} label={`অর্ডার মূল্য · ${n(o.quantity)} পিস`} />
        <Stat value={n(cut)} label="কাটিং হয়েছে" />
        <Stat value={n(p.sewn)} label={`সেলাই হয়েছে · দৈনিক গতি ${n(p.pace)} পিস`} />
        <Stat value={day(p.finish)} label={`সম্ভাব্য সেলাই সমাপ্তি · সময়সীমা ${day(p.sewingDeadline)}`} tone={p.late ? 'alert' : p.finish ? 'ok' : undefined} />
      </div>

      <PlanSection order={o} milestones={milestones} can={can} config={config} />
      {config.modules.techpack ? <TechPackSection order={o} pack={packs[0]} nameOf={nameOf} canManage={can['techpack.manage']} /> : null}
      <MaterialsSection order={o} master={master} amendments={amendments} lcs={orderLcs} ud={orderUd} materials={materials} nameOf={nameOf} can={can} config={config} />
      {config.modules.bond ? <BondSection order={o} ud={orderUd[0]} entries={bond} nameOf={nameOf} canWrite={can['bond.manage']} /> : null}
      <ProductionSection order={o} lays={orderLays} sewing={orderSewing} defects={orderDefects} lots={orderLots} nameOf={nameOf} can={can} config={config} lines={plan.lines} />
      <ExportDocsSection order={o} master={master} rows={packed} invoice={invs[0]} blQty={latestBl?.quantity ?? null} can={can} />
      <ShipSection order={o} master={master} bls={bls} nameOf={nameOf} can={can} config={config} quantityAccepted={orderLots.some((l) => l.result === 'accepted')} />
      <MoneyIn order={o} lcs={orderLcs} />
    </>
  )
}
