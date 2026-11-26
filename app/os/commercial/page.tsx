import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bom, lcs, orders, ud } from '@/lib/db/schema'
import { daysBetween, today } from '@/lib/domain'
import { day, n, usd, usdK } from '@/lib/format'
import { Chip, Empty, PageHeader, Section, Stat } from '@/components/os/ui'

export const metadata = { title: 'lc, btb & ud' }

export default async function CommercialPage() {
  const [allLcs, allOrders, allUd, allBom] = await Promise.all([
    db.select().from(lcs).orderBy(asc(lcs.maturity)),
    db.select().from(orders),
    db.select().from(ud),
    db.select().from(bom),
  ])
  const t = today()
  const code = (id: number | null) => allOrders.find((o) => o.id === id)?.code ?? '—'
  const masters = allLcs.filter((l) => l.kind === 'master')
  const btbs = allLcs.filter((l) => l.kind === 'btb')
  const liability = btbs.filter((b) => b.status === 'opened' && b.settledAmount == null)
  const due30 = liability.filter((b) => b.maturity && daysBetween(t, b.maturity) <= 30)

  return (
    <>
      <PageHeader
        eyebrow="commercial"
        title="Letters of credit, back-to-back and UD"
        lede="Every btb lc is opened against a master lc and capped at 75% of it. Maturities are tracked so nothing reaches the bank unpaid."
      />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={usdK(masters.filter((m) => m.status === 'opened').reduce((s, m) => s + m.amount, 0))} label="master lcs opened" />
        <Stat value={usdK(liability.reduce((s, b) => s + b.amount, 0))} label="btb liability outstanding" />
        <Stat value={due30.length} label="btb maturing in 30 days" tone={due30.length ? 'alert' : undefined} />
        <Stat value={masters.filter((m) => m.status === 'requested').length} label="master lcs awaited" />
      </div>

      <Section title="master lcs">
        {masters.length === 0 ? (
          <Empty>None.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>lc</th>
                  <th>order</th>
                  <th className="text-right">value</th>
                  <th className="text-right">btb used</th>
                  <th>bank</th>
                  <th>latest shipment</th>
                  <th>status</th>
                </tr>
              </thead>
              <tbody>
                {masters.map((m) => {
                  const used = btbs.filter((b) => b.masterId === m.id).reduce((s, b) => s + b.amount, 0)
                  const share = m.amount ? (used / m.amount) * 100 : 0
                  return (
                    <tr key={m.id}>
                      <td className="font-medium">{m.number}</td>
                      <td>
                        <Link href={`/os/orders/${m.orderId}`} className="text-ink underline-offset-4 hover:underline">
                          {code(m.orderId)}
                        </Link>
                      </td>
                      <td className="num text-right">{usd(m.amount)}</td>
                      <td className={`num text-right ${share > 75 ? 'text-alert' : ''}`}>{share.toFixed(0)}%</td>
                      <td>{m.bank ?? '—'}</td>
                      <td>{day(m.latestShipment)}</td>
                      <td>
                        <Chip status={m.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="back-to-back lcs by maturity">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>btb</th>
                <th>order</th>
                <th className="text-right">amount</th>
                <th>tenor</th>
                <th>matures</th>
                <th>status</th>
              </tr>
            </thead>
            <tbody>
              {btbs.map((b) => {
                const left = b.maturity ? daysBetween(t, b.maturity) : null
                return (
                  <tr key={b.id}>
                    <td className="font-medium">{b.number}</td>
                    <td>{code(b.orderId)}</td>
                    <td className="num text-right">{usd(b.amount)}</td>
                    <td>{b.tenorDays} days</td>
                    <td className={left != null && left <= 30 && b.settledAmount == null ? 'text-alert' : ''}>
                      {day(b.maturity)}
                      {left != null && b.settledAmount == null ? <span className="text-xs text-subtle"> · {left}d</span> : null}
                    </td>
                    <td>{b.settledAmount != null ? <Chip status="closed">settled</Chip> : <Chip status={b.status} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="utilization declarations">
        {allUd.length === 0 ? (
          <Empty>No UD recorded.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>ud</th>
                <th>order</th>
                <th className="text-right">yarn permitted</th>
                <th className="text-right">booked</th>
                <th className="text-right">headroom</th>
              </tr>
            </thead>
            <tbody>
              {allUd.map((u) => {
                const used = allBom.filter((b) => b.orderId === u.orderId && b.unit === 'kg').reduce((s, b) => s + b.qty, 0)
                return (
                  <tr key={u.id}>
                    <td className="font-medium">{u.number}</td>
                    <td>{code(u.orderId)}</td>
                    <td className="num text-right">{n(u.yarnPermittedKg)} kg</td>
                    <td className="num text-right">{n(used)} kg</td>
                    <td className={`num text-right ${used > u.yarnPermittedKg ? 'text-alert' : 'text-ok'}`}>{n(u.yarnPermittedKg - used)} kg</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Section>
    </>
  )
}
