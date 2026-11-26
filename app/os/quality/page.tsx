import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { defects, lots, orders, people, sewing } from '@/lib/db/schema'
import { getConfig, getFloorPlan } from '@/lib/settings'
import { lineName } from '@/lib/config'
import { bn, n, pct, stamp } from '@/lib/format'
import { Chip, Empty, PageHeader, Section, Stat } from '@/components/os/ui'

export const metadata = { title: 'মান নিয়ন্ত্রণ' }

export default async function QualityPage() {
  const [config, plan, allDefects, allLots, allOrders, allSewing, staff] = await Promise.all([
    getConfig(),
    getFloorPlan(),
    db.select().from(defects),
    db.select().from(lots).orderBy(desc(lots.createdAt)),
    db.select({ id: orders.id, code: orders.code }).from(orders),
    db.select({ line: sewing.line, actual: sewing.actual }).from(sewing),
    db.select({ id: people.id, name: people.name }).from(people),
  ])
  const total = allDefects.reduce((s, d) => s + d.count, 0)
  const sewn = allSewing.reduce((s, r) => s + r.actual, 0)
  const labelOf = (code: string, fallback: string) => config.defects.find((d) => d.code === code)?.label ?? fallback
  const tally = new Map<string, { code: string; label: string; count: number }>()
  for (const d of allDefects) {
    const c = tally.get(d.code) ?? { code: d.code, label: labelOf(d.code, d.label), count: 0 }
    tally.set(d.code, { ...c, count: c.count + d.count })
  }
  const pareto = [...tally.values()].sort((a, b) => b.count - a.count)
  let running = 0
  const lines = [...new Set(allDefects.map((d) => d.line))].sort((a, b) => a - b)
  const sewnByLine = (l: number) => allSewing.filter((s) => s.line === l).reduce((s, r) => s + r.actual, 0)
  const orderCode = (id: number) => allOrders.find((o) => o.id === id)?.code ?? '—'

  return (
    <>
      <PageHeader eyebrow={`মান নিয়ন্ত্রণ · একিউএল ${bn(config.quality.aql)}, লেভেল ${config.quality.level}`} title="ত্রুটি ও চূড়ান্ত পরিদর্শন" />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={n(total)} label="লিপিবদ্ধ ত্রুটি" />
        <Stat value={sewn ? pct((total / sewn) * 100) : '—'} label="প্রতি ১০০ পিসে ত্রুটি" tone={sewn && total / sewn > 0.05 ? 'alert' : undefined} />
        <Stat value={n(allLots.filter((l) => l.result === 'accepted').length)} label="গৃহীত লট" tone="ok" />
        <Stat value={n(allLots.filter((l) => l.result === 'rejected').length)} label="প্রত্যাখ্যাত লট" tone={allLots.some((l) => l.result === 'rejected') ? 'alert' : undefined} />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="প্যারেটো · আগে কী ঠিক করবেন">
          {pareto.length === 0 ? (
            <Empty>কোনো ত্রুটি লেখা হয়নি।</Empty>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {pareto.map((d) => {
                running += d.count
                return (
                  <li key={d.code} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-3 text-sm">
                    <span className="truncate">{d.label}</span>
                    <span className="h-2 rounded-full bg-key" aria-hidden="true">
                      <span className="block h-full rounded-full bg-ink-fill" style={{ width: `${(d.count / pareto[0].count) * 100}%` }} />
                    </span>
                    <span className="num text-right text-muted">
                      {n(d.count)} · {pct((running / total) * 100, 0)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
        <Section title="লাইন অনুযায়ী">
          {lines.length === 0 ? (
            <Empty>কোনো লাইনে ত্রুটি লেখা হয়নি।</Empty>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>লাইন</th>
                  <th className="text-right">ত্রুটি</th>
                  <th className="text-right">সেলাই</th>
                  <th className="text-right">ডিএইচইউ</th>
                  <th>প্রধান ত্রুটি</th>
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
                      <td>{lineName(plan.lines, l)}</td>
                      <td className="num text-right">{n(c)}</td>
                      <td className="num text-right">{n(s)}</td>
                      <td className={`num text-right ${dhu > 5 ? 'text-alert' : ''}`}>{pct(dhu)}</td>
                      <td>{topD ? labelOf(topD.code, topD.label) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Section>
      </div>

      <Section title="চূড়ান্ত পরিদর্শন">
        {allLots.length === 0 ? (
          <Empty>এখনো কোনো লট পরিদর্শন করা হয়নি। অর্ডারের পাতা থেকে পরিদর্শন করুন।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-160">
              <thead>
                <tr>
                  <th>অর্ডার</th>
                  <th className="text-right">লট</th>
                  <th className="text-right">নমুনা</th>
                  <th className="text-right">মেজর</th>
                  <th className="text-right">গ্রহণযোগ্য ≤</th>
                  <th>পরিকল্পনা</th>
                  <th>ফলাফল</th>
                  <th>সিদ্ধান্ত</th>
                </tr>
              </thead>
              <tbody>
                {allLots.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/os/orders/${l.orderId}`} className="text-ink underline-offset-4 hover:underline">
                        {orderCode(l.orderId)}
                      </Link>
                    </td>
                    <td className="num text-right">{n(l.lotSize)}</td>
                    <td className="num text-right">{n(l.sample)}</td>
                    <td className="num text-right">{n(l.major)}</td>
                    <td className="num text-right">{n(l.acceptMax)}</td>
                    <td className="num text-muted">
                      {bn(l.aql)} · {l.level}
                    </td>
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
          </div>
        )}
      </Section>
    </>
  )
}
