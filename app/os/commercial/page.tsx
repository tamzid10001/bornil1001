import Link from 'next/link'
import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bom, lcs, orders, ud } from '@/lib/db/schema'
import { daysBetween, today, unitLabel } from '@/lib/config'
import { getConfig } from '@/lib/settings'
import { getActor, grantsFor } from '@/lib/actor'
import { bn, day, n, tk, tkK } from '@/lib/format'
import { Chip, Empty, ModuleOff, PageHeader, Section, Stat } from '@/components/os/ui'

export const metadata = { title: 'এলসি, বিটুবি ও ইউডি' }

export default async function CommercialPage() {
  const [config, actor] = await Promise.all([getConfig(), getActor()])
  if (!config.modules.commercial) return <ModuleOff title="এলসি ও রপ্তানির কাগজ" canChange={grantsFor(actor)['settings.manage']} />
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
        eyebrow="কমার্শিয়াল"
        title="মাস্টার এলসি, ব্যাক-টু-ব্যাক এলসি ও ইউডি"
      />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={tkK(masters.filter((m) => m.status === 'opened').reduce((s, m) => s + m.amount, 0))} label="খোলা মাস্টার এলসি" />
        <Stat value={tkK(liability.reduce((s, b) => s + b.amount, 0))} label="বকেয়া বিটুবি দায়" />
        <Stat value={bn(due30.length)} label="আগামী ৩০ দিনে মেয়াদপূর্ণ বিটুবি" tone={due30.length ? 'alert' : undefined} />
        <Stat value={bn(masters.filter((m) => m.status === 'requested').length)} label="অপেক্ষমাণ মাস্টার এলসি" />
      </div>

      <Section title="মাস্টার এলসি">
        {masters.length === 0 ? (
          <Empty>কোনো মাস্টার এলসি নেই।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>এলসি</th>
                  <th>অর্ডার</th>
                  <th className="text-right">মূল্য</th>
                  <th className="text-right">বিটুবি ব্যবহার</th>
                  <th>ব্যাংক</th>
                  <th>সর্বশেষ শিপমেন্ট</th>
                  <th>অবস্থা</th>
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
                      <td className="num text-right">{tk(m.amount)}</td>
                      <td className={`num text-right ${share > 75 ? 'text-alert' : ''}`}>{bn(share.toFixed(0))}%</td>
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

      <Section title="মেয়াদ অনুযায়ী ব্যাক-টু-ব্যাক এলসি">
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>বিটুবি</th>
                <th>অর্ডার</th>
                <th className="text-right">মূল্য</th>
                <th>মেয়াদ</th>
                <th>মেয়াদপূর্তি</th>
                <th>অবস্থা</th>
              </tr>
            </thead>
            <tbody>
              {btbs.map((b) => {
                const left = b.maturity ? daysBetween(t, b.maturity) : null
                return (
                  <tr key={b.id}>
                    <td className="font-medium">{b.number}</td>
                    <td>{code(b.orderId)}</td>
                    <td className="num text-right">{tk(b.amount)}</td>
                    <td>{bn(b.tenorDays)} দিন</td>
                    <td className={left != null && left <= 30 && b.settledAmount == null ? 'text-alert' : ''}>
                      {day(b.maturity)}
                      {left != null && b.settledAmount == null ? <span className="text-xs text-subtle"> · {bn(left)} দিন বাকি</span> : null}
                    </td>
                    <td>{b.settledAmount != null ? <Chip status="closed">পরিশোধিত</Chip> : <Chip status={b.status} />}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="ইউটিলাইজেশন ডিক্লারেশন (ইউডি)">
        {allUd.length === 0 ? (
          <Empty>কোনো ইউডি লেখা হয়নি।</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>ইউডি</th>
                <th>অর্ডার</th>
                <th className="text-right">অনুমোদিত</th>
                <th className="text-right">বুক করা</th>
                <th className="text-right">বাকি সীমা</th>
              </tr>
            </thead>
            <tbody>
              {allUd.map((u) => {
                const used = allBom.filter((b) => b.orderId === u.orderId && b.kind === 'fabric' && b.unit === u.permittedUnit).reduce((s, b) => s + b.qty, 0)
                const unit = unitLabel(u.permittedUnit)
                return (
                  <tr key={u.id}>
                    <td className="font-medium">{u.number}</td>
                    <td>{code(u.orderId)}</td>
                    <td className="num text-right">
                      {u.material} {n(u.permittedQty)} {unit}
                    </td>
                    <td className="num text-right">
                      {n(used)} {unit}
                    </td>
                    <td className={`num text-right ${used > u.permittedQty ? 'text-alert' : 'text-ok'}`}>
                      {n(u.permittedQty - used)} {unit}
                    </td>
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
