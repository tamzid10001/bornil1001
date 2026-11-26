import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { defects, lots, orders, people, sewing } from '@/lib/db/schema'
import { getLang } from '@/lib/i18n'
import { DEFECT_CODES } from '@/lib/domain'
import { n, pct, stamp } from '@/lib/format'
import { Chip, Empty, PageHeader, Section, Stat } from '@/components/os/ui'

export const metadata = { title: 'quality' }

export default async function QualityPage() {
  const [lang, allDefects, allLots, allOrders, allSewing, staff] = await Promise.all([
    getLang(),
    db.select().from(defects),
    db.select().from(lots).orderBy(desc(lots.createdAt)),
    db.select().from(orders),
    db.select().from(sewing),
    db.select().from(people),
  ])
  const total = allDefects.reduce((s, d) => s + d.count, 0)
  const sewn = allSewing.reduce((s, r) => s + r.actual, 0)
  const pareto = DEFECT_CODES.map((d) => ({ ...d, count: allDefects.filter((x) => x.code === d.code).reduce((s, x) => s + x.count, 0) }))
    .filter((d) => d.count)
    .sort((a, b) => b.count - a.count)
  let running = 0
  const lines = [...new Set(allDefects.map((d) => d.line))].sort((a, b) => a - b)
  const sewnByLine = (l: number) => allSewing.filter((s) => s.line === l).reduce((s, r) => s + r.actual, 0)
  const orderCode = (id: number) => allOrders.find((o) => o.id === id)?.code ?? '—'

  return (
    <>
      <PageHeader
        eyebrow="quality"
        title="Defects and final inspections"
      />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={n(total)} label="defects logged" />
        <Stat value={sewn ? pct((total / sewn) * 100) : '—'} label="defects per hundred units" tone={sewn && total / sewn > 0.05 ? 'alert' : undefined} />
        <Stat value={allLots.filter((l) => l.result === 'accepted').length} label="lots accepted" tone="ok" />
        <Stat value={allLots.filter((l) => l.result === 'rejected').length} label="lots rejected" tone={allLots.some((l) => l.result === 'rejected') ? 'alert' : undefined} />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="pareto · what to fix first">
          {pareto.length === 0 ? (
            <Empty>No defects logged.</Empty>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {pareto.map((d) => {
                running += d.count
                return (
                  <li key={d.code} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-sm">
                    <span className="truncate">{lang === 'bn' ? d.bn : d.label}</span>
                    <span className="h-2 rounded-full bg-key" aria-hidden="true">
                      <span className="block h-full rounded-full bg-ink-fill" style={{ width: `${(d.count / pareto[0].count) * 100}%` }} />
                    </span>
                    <span className="num text-right text-muted">
                      {d.count} · {pct((running / total) * 100, 0)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
        <Section title="by line">
          <table className="tbl">
            <thead>
              <tr>
                <th>line</th>
                <th className="text-right">defects</th>
                <th className="text-right">sewn</th>
                <th className="text-right">dhu</th>
                <th>top defect</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const ds = allDefects.filter((d) => d.line === l)
                const c = ds.reduce((s, d) => s + d.count, 0)
                const s = sewnByLine(l)
                const topD = [...ds].sort((a, b) => b.count - a.count)[0]
                const dhu = s ? (c / s) * 100 : 0
                return (
                  <tr key={l}>
                    <td>line {l}</td>
                    <td className="num text-right">{c}</td>
                    <td className="num text-right">{n(s)}</td>
                    <td className={`num text-right ${dhu > 5 ? 'text-alert' : ''}`}>{pct(dhu)}</td>
                    <td>{topD?.label ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Section>
      </div>

      <Section title="final inspections">
        {allLots.length === 0 ? (
          <Empty>No lots offered yet. Inspect from the order page.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>order</th>
                <th className="text-right">lot</th>
                <th className="text-right">sample</th>
                <th className="text-right">major</th>
                <th className="text-right">accept ≤</th>
                <th>result</th>
                <th>decided</th>
              </tr>
            </thead>
            <tbody>
              {allLots.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/os/orders/${l.orderId}`} className="text-ink underline-offset-4 hover:underline">
                      {orderCode(l.orderId)}
                    </Link>
                  </td>
                  <td className="num text-right">{n(l.lotSize)}</td>
                  <td className="num text-right">{l.sample}</td>
                  <td className="num text-right">{l.major}</td>
                  <td className="num text-right">{l.acceptMax}</td>
                  <td>
                    <Chip status={l.result} />
                  </td>
                  <td className="text-muted">
                    {staff.find((p) => p.id === l.decidedBy)?.name ?? '—'} · {stamp(l.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  )
}
