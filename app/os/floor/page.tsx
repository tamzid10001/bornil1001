import { desc, gte, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, sewing } from '@/lib/db/schema'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig, getFloorPlan } from '@/lib/settings'
import { LINE_KINDS, today } from '@/lib/config'
import { bn, n, pct } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Empty, PageHeader, Section, TextLink } from '@/components/os/ui'
import { logSewing } from '../actions/orders'

export const metadata = { title: 'উৎপাদন ফ্লোর' }

const dhakaDay = (d: Date) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10)
const dhakaHour = (d: Date) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(11, 13)

export default async function FloorPage() {
  const since = new Date(Date.now() - 36 * 3600_000)
  const [open, rows, plan, config, actor] = await Promise.all([
    db.select().from(orders).where(isNull(orders.closedAt)),
    db.select().from(sewing).where(gte(sewing.hourAt, since)).orderBy(desc(sewing.hourAt)),
    getFloorPlan(),
    getConfig(),
    getActor(),
  ])
  const can = grantsFor(actor)
  const t = today()
  const todays = rows.filter((r) => dhakaDay(r.hourAt) === t)
  const alertAt = config.production.efficiencyAlert
  const live = plan.lines.filter((l) => l.active)
  const sewable = open.filter((o) => o.ppSignedAt)
  const target = todays.reduce((s, r) => s + r.target, 0)
  const actual = todays.reduce((s, r) => s + r.actual, 0)

  return (
    <>
      <PageHeader
        eyebrow={`উৎপাদন ফ্লোর · আজ${target ? ` · দক্ষতা ${pct((actual / target) * 100, 0)}` : ''}`}
        title="ঘণ্টাভিত্তিক উৎপাদন"
        actions={can['settings.manage'] ? <TextLink href="/os/settings/floor">ফ্লোর প্ল্যান সাজান</TextLink> : null}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-10">
          {plan.floors.length === 0 ? (
            <Empty>
              এখনো কোনো ফ্লোর বা লাইন সাজানো হয়নি।{' '}
              {can['settings.manage'] ? <TextLink href="/os/settings/floor">ফ্লোর প্ল্যান তৈরি করুন</TextLink> : 'মালিককে ফ্লোর প্ল্যান তৈরি করতে বলুন।'}
            </Empty>
          ) : (
            plan.floors.map((f) => {
              const floorLines = live.filter((l) => l.floorId === f.id)
              return (
                <Section key={f.id} title={f.building ? `${f.name} · ${f.building}` : f.name} aside={<span className="text-sm text-muted">{bn(floorLines.length)}টি চালু লাইন</span>}>
                  {floorLines.length === 0 ? (
                    <Empty>এই ফ্লোরে কোনো চালু লাইন নেই।</Empty>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {floorLines.map((line) => {
                        const hrs = todays.filter((r) => r.line === line.id).sort((a, b) => a.hourAt.getTime() - b.hourAt.getTime())
                        const lt = hrs.reduce((s, r) => s + r.target, 0)
                        const la = hrs.reduce((s, r) => s + r.actual, 0)
                        const eff = lt ? (la / lt) * 100 : 0
                        const order = open.find((o) => o.id === hrs[hrs.length - 1]?.orderId)
                        return (
                          <article key={line.id} id={`line-${line.id}`} className="flex scroll-mt-6 flex-col gap-3 rounded-xl border border-rule p-4">
                            <header className="flex items-baseline justify-between gap-2">
                              <h3 className="font-heading text-lg font-semibold">{line.name}</h3>
                              {hrs.length ? (
                                <span className={`num font-heading text-2xl font-semibold ${eff < alertAt ? 'text-alert' : 'text-ok'}`}>{pct(eff, 0)}</span>
                              ) : (
                                <span className="text-xs text-subtle">আজ এখনো হিসাব নেই</span>
                              )}
                            </header>
                            <p className="text-sm text-muted">
                              {LINE_KINDS[line.kind] ?? line.kind} · ঘণ্টায় লক্ষ্য {n(line.hourlyTarget)}
                              {line.operators ? ` · ${bn(line.operators)} জন অপারেটর` : ''}
                              {hrs.length ? ` · ${order?.code ?? ''} ${n(la)} / ${n(lt)}` : ''}
                            </p>
                            {hrs.length ? (
                              <ol className="flex h-16 items-end gap-1" aria-label={`${line.name}-এর ঘণ্টাভিত্তিক আউটপুট`}>
                                {hrs.map((h) => {
                                  const r = h.target ? h.actual / h.target : 0
                                  return (
                                    <li key={h.id} className="flex flex-1 flex-col items-center gap-1" title={`${dhakaHour(h.hourAt)}:০০ · ${h.actual}/${h.target}${h.note ? ` · ${h.note}` : ''}`}>
                                      <span className={`w-full rounded-sm ${r * 100 < alertAt ? 'bg-alert' : 'bg-ink-fill'}`} style={{ height: `${Math.max(6, Math.min(100, r * 100)) * 0.48}px` }} />
                                      <span className="num text-[10px] text-subtle">{bn(dhakaHour(h.hourAt))}</span>
                                    </li>
                                  )
                                })}
                              </ol>
                            ) : null}
                            {hrs.some((h) => h.note) ? <p className="text-xs text-alert">{hrs.filter((h) => h.note).map((h) => h.note).join(' · ')}</p> : null}
                          </article>
                        )
                      })}
                    </div>
                  )}
                </Section>
              )
            })
          )}
        </div>

        <Section title="এক ঘণ্টার হিসাব দিন">
          {!can['sewing.record'] ? (
            <p className="text-sm text-muted">আউটপুট লেখার অনুমতি আপনার ভূমিকায় নেই।</p>
          ) : !live.length || !open.length ? (
            <Empty>{!live.length ? 'আগে ফ্লোর প্ল্যানে অন্তত একটি চালু লাইন যোগ করুন।' : 'চলমান কোনো অর্ডার নেই।'}</Empty>
          ) : (
            <ActionForm action={logSewing} resetOnSuccess className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="label">অর্ডার</span>
                <select name="order_id" required className="field">
                  {open.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code} · {o.style}
                      {config.gates.pp && !o.ppSignedAt ? ' (পিপি স্বাক্ষর হয়নি)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">লাইন</span>
                <select name="line" required className="field h-12 text-lg">
                  {live.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · লক্ষ্য {bn(l.hourlyTarget)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="label">লক্ষ্য</span>
                  <input name="target" type="number" min={1} defaultValue={live[0].hourlyTarget} required inputMode="numeric" className="field num h-12 text-lg" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">প্রকৃত</span>
                  <input name="actual" type="number" min={0} required inputMode="numeric" className="field num h-12 text-lg" />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="label">বন্ধ ছিল (মিনিট)</span>
                <input name="downtime" type="number" min={0} max={60} defaultValue={0} inputMode="numeric" className="field num" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">কারণ</span>
                <input name="note" className="field" placeholder="যেমন মেশিন নষ্ট, কাপড় আসতে দেরি…" />
              </label>
              <Submit>জমা দিন</Submit>
              {config.gates.pp && sewable.length < open.length ? <p className="text-xs text-subtle">পিপি মিটিংয়ে স্বাক্ষর না হওয়া অর্ডারের হিসাব গ্রহণ করা হবে না।</p> : null}
            </ActionForm>
          )}
        </Section>
      </div>
    </>
  )
}
