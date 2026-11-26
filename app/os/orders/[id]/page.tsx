import { notFound } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bl, bom, defects, lays, lcs, lots, people, sewing, tna, ud } from '@/lib/db/schema'
import { getActor } from '@/lib/actor'
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
  const o = await getOrder(Number(id))
  if (!o) notFound()

  const [actor, staff, milestones, orderLcs, orderUd, materials, orderLays, orderSewing, orderDefects, orderLots, bls] = await Promise.all([
    getActor(),
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
  ])
  const nameOf = (pid: number | null) => staff.find((p) => p.id === pid)?.name ?? '—'
  const p = projection(o, orderSewing)
  const master = orderLcs.find((l) => l.kind === 'master')
  const cut = orderLays.reduce((s, l) => s + l.plies * Object.values(l.ratio).reduce((a, b) => a + b, 0), 0)
  const role = actor?.role ?? ''

  return (
    <>
      <PageHeader
        eyebrow={`${o.buyer} · ships ${day(o.shipDate)}`}
        title={`${o.code} — ${o.style}`}
        lede={`${o.fabric ?? 'fabric tbc'} · ${Object.entries(o.sizes).map(([k, v]) => `${k} ${n(v)}`).join(' · ')}`}
        actions={o.closedAt ? <Chip status="closed" /> : p.late ? <Chip status="late">projected late</Chip> : null}
      />
      <StageRail stage={o.stage} />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={tkK(o.quantity * o.fob)} label={`order value · ${n(o.quantity)} pcs`} />
        <Stat value={n(cut)} label="cut" />
        <Stat value={n(p.sewn)} label={`sewn · ${n(p.pace)} / day pace`} />
        <Stat value={day(p.finish)} label={`projected sewing finish · deadline ${day(p.sewingDeadline)}`} tone={p.late ? 'alert' : p.finish ? 'ok' : undefined} />
      </div>

      <PlanSection order={o} milestones={milestones} role={role} />
      <MaterialsSection order={o} master={master} lcs={orderLcs} ud={orderUd} materials={materials} nameOf={nameOf} role={role} />
      <ProductionSection order={o} lays={orderLays} sewing={orderSewing} defects={orderDefects} lots={orderLots} nameOf={nameOf} role={role} />
      <ShipSection order={o} master={master} bls={bls} nameOf={nameOf} role={role} quantityAccepted={orderLots.some((l) => l.result === 'accepted')} />
      <MoneyIn order={o} lcs={orderLcs} />
    </>
  )
}
