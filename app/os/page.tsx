import Link from 'next/link'
import { desc, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { audit, bl, orders, sewing } from '@/lib/db/schema'
import { getExceptions, projection } from '@/lib/queries'
import { DEPT_LABEL, today } from '@/lib/domain'
import { bn, day, n, pct, stamp, tkK } from '@/lib/format'
import { PageHeader, Section, StageRail, Stat } from '@/components/os/ui'
import { acronyms } from '@/lib/acronyms'

export const metadata = { title: 'আজ রাতে' }

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
        eyebrow={new Date().toLocaleDateString('bn-BD', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' })}
        title="আজ রাতে যা আপনার নজর চায়।"
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={gates.length} label="গেটে আটকে আছে" tone={gates.length ? 'alert' : 'ok'} />
        <Stat value={risks.length} label="পিছিয়ে আছে বা বন্ধ" tone={risks.length ? 'alert' : undefined} />
        <Stat value={target ? pct((actual / target) * 100, 0) : '—'} label={`ফ্লোর দক্ষতা · আজ ${bn(lines)}টি লাইন`} />
        <Stat value={tkK(book)} label={`চলমান অর্ডার বুক · ${bn(openOrders.length)}টি অর্ডার`} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <Section title="ব্যতিক্রম" aside={<span className="num text-sm text-muted">{bn(exceptions.length)}টি খোলা</span>}>
          {exceptions.length === 0 ? (
            <p className="text-muted">কিছুই আপনার নজর চাইছে না। বাড়ি যান।</p>
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
                      <span className="sr-only">{e.kind === 'gate' ? 'গেট' : e.kind === 'risk' ? 'ঝুঁকি' : 'তথ্য'} · </span>
                      {DEPT_LABEL[e.dept] ?? e.dept}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="flex flex-col gap-10">
          <Section title="ফ্লোরে চলমান অর্ডার">
            <ul className="flex flex-col gap-4">
              {openOrders.map((o) => {
                const p = projection(o, allSewing.filter((s) => s.orderId === o.id))
                return (
                  <li key={o.id}>
                    <Link href={`/os/orders/${o.id}`} className="group flex flex-col gap-2">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="font-medium group-hover:text-ink">{o.code}</span>
                        <span className="text-xs text-muted">শিপমেন্ট {day(o.shipDate)}</span>
                      </span>
                      <span className="truncate text-sm text-muted">
                        {o.buyer} · {n(o.quantity)} পিস
                        {p.sewn ? ` · ${n(p.sewn)} সেলাই হয়েছে` : ''}
                      </span>
                      <StageRail stage={o.stage} />
                    </Link>
                  </li>
                )
              })}
            </ul>
            {shippingSoon ? <p className="text-sm text-muted">{bn(shippingSoon)}টি বি/এল খসড়া অবস্থায়।</p> : null}
          </Section>

          <Section title="আজকের স্বাক্ষর">
            <ul className="flex flex-col gap-3 text-sm">
              {recent.map((a) => (
                <li key={a.id} className="flex flex-col">
                  <span>
                    <span className="font-medium">{a.actor.split(' · ')[0]}</span> {acronyms(a.action)}
                  </span>
                  <span className="text-xs text-subtle">
                    {a.detail} · {stamp(a.at)}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/os/approvals" className="text-sm text-ink underline underline-offset-4">
              পূর্ণ অডিট ট্রেইল
            </Link>
          </Section>
        </div>
      </div>
    </>
  )
}
