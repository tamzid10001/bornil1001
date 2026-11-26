import Link from 'next/link'
import { desc, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { audit, bl, orders, sewing } from '@/lib/db/schema'
import { getExceptions, projection } from '@/lib/queries'
import { today } from '@/lib/domain'
import { day, n, pct, stamp, usdK } from '@/lib/format'
import { PageHeader, Section, StageRail, Stat } from '@/components/os/ui'

export const metadata = { title: 'tonight' }

export default async function TonightPage() {
  const t = today()
  const [exceptions, openOrders, allSewing, recent, bls] = await Promise.all([
    getExceptions(),
    db.select().from(orders).where(isNull(orders.closedAt)),
    db.select().from(sewing),
    db.select().from(audit).orderBy(desc(audit.at)).limit(8),
    db.select().from(bl),
  ])

  const todayRows = allSewing.filter((s) => new Date(s.hourAt.getTime() + 6 * 3600_000).toISOString().slice(0, 10) === t)
  const target = todayRows.reduce((s, r) => s + r.target, 0)
  const actual = todayRows.reduce((s, r) => s + r.actual, 0)
  const lines = new Set(todayRows.map((r) => r.line)).size
  const book = openOrders.reduce((s, o) => s + o.quantity * o.fob, 0)
  const gates = exceptions.filter((e) => e.kind === 'gate')
  const risks = exceptions.filter((e) => e.kind === 'risk')
  const info = exceptions.filter((e) => e.kind === 'info')
  const shippingSoon = bls.filter((b) => b.status !== 'released').length

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' }).toLowerCase()}
        title="What needs you tonight."
        lede="Everything that went to plan is left out. What remains is held at a gate, slipping on the critical path, or waiting for a person."
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={gates.length} label="held at a gate" tone={gates.length ? 'alert' : 'ok'} />
        <Stat value={risks.length} label="slipping or down" tone={risks.length ? 'alert' : undefined} />
        <Stat value={target ? pct((actual / target) * 100, 0) : '—'} label={`floor efficiency · ${lines} lines today`} />
        <Stat value={usdK(book)} label={`open order book · ${openOrders.length} orders`} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <Section title="exceptions" aside={<span className="num text-sm text-muted">{exceptions.length} open</span>}>
          {exceptions.length === 0 ? (
            <p className="text-muted">Nothing needs you. Go home.</p>
          ) : (
            <ul className="flex flex-col">
              {[...gates, ...risks, ...info].map((e, i) => (
                <li key={i} className="border-t border-rule first:border-t-0">
                  <Link href={e.href} className="group flex gap-4 py-4">
                    <span
                      aria-hidden="true"
                      className={`mt-2 size-2 shrink-0 rounded-full ${e.kind === 'gate' ? 'bg-alert' : e.kind === 'risk' ? 'bg-ink-fill' : 'bg-rule'}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-medium group-hover:text-ink">{e.title}</span>
                      <span className="text-sm leading-relaxed text-muted">{e.detail}</span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-subtle sm:block">
                      <span className="sr-only">{e.kind} · </span>
                      {e.dept}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="flex flex-col gap-10">
          <Section title="orders on the floor">
            <ul className="flex flex-col gap-4">
              {openOrders.map((o) => {
                const p = projection(o, allSewing.filter((s) => s.orderId === o.id))
                return (
                  <li key={o.id}>
                    <Link href={`/os/orders/${o.id}`} className="group flex flex-col gap-2">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-medium group-hover:text-ink">{o.code}</span>
                        <span className="text-xs text-muted">ships {day(o.shipDate)}</span>
                      </span>
                      <span className="truncate text-sm text-muted">
                        {o.buyer} · {n(o.quantity)} pcs
                        {p.sewn ? ` · ${n(p.sewn)} sewn` : ''}
                      </span>
                      <StageRail stage={o.stage} />
                    </Link>
                  </li>
                )
              })}
            </ul>
            {shippingSoon ? <p className="text-sm text-muted">{shippingSoon} b/l in draft.</p> : null}
          </Section>

          <Section title="signed today">
            <ul className="flex flex-col gap-3 text-sm">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-col">
                  <span>
                    <span className="font-medium">{a.actor.split(' · ')[0]}</span> {a.action}
                  </span>
                  <span className="text-xs text-subtle">
                    {a.detail} · {stamp(a.at)}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/os/approvals" className="text-sm text-ink underline underline-offset-4">
              full audit trail
            </Link>
          </Section>
        </div>
      </div>
    </>
  )
}
