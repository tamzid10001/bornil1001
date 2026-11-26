import { desc, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, sewing } from '@/lib/db/schema'
import { getLang } from '@/lib/i18n'
import { today } from '@/lib/domain'
import { bn, n, pct } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Empty, PageHeader, Section } from '@/components/os/ui'
import { logSewing } from '../actions/orders'

export const metadata = { title: 'সেলাই লাইন' }

const dhakaDay = (d: Date) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(0, 10)
const dhakaHour = (d: Date) => new Date(d.getTime() + 6 * 3600_000).toISOString().slice(11, 13)

export default async function FloorPage() {
  const [lang, open, rows] = await Promise.all([
    getLang(),
    db.select().from(orders).where(isNull(orders.closedAt)),
    db.select().from(sewing).orderBy(desc(sewing.hourAt)),
  ])
  const t = today()
  const todays = rows.filter((r) => dhakaDay(r.hourAt) === t)
  const lines = [...new Set(todays.map((r) => r.line))].sort((a, b) => a - b)
  const sewable = open.filter((o) => o.ppSignedAt)
  const L = lang === 'bn'
  const num = (v: number) => (L ? bn(n(v)) : n(v))

  return (
    <>
      <PageHeader
        eyebrow={L ? 'সেলাই ফ্লোর · আজ' : 'sewing floor · today'}
        title={L ? 'ঘণ্টাভিত্তিক উৎপাদন' : 'Hour-by-hour output'}
      />

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section title={L ? 'লাইন' : 'lines'}>
          {lines.length === 0 ? (
            <Empty>{L ? 'আজ এখনো কোনো হিসাব লেখা হয়নি।' : 'No entries yet today.'}</Empty>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {lines.map((line) => {
                const hrs = todays.filter((r) => r.line === line).sort((a, b) => a.hourAt.getTime() - b.hourAt.getTime())
                const target = hrs.reduce((s, r) => s + r.target, 0)
                const actual = hrs.reduce((s, r) => s + r.actual, 0)
                const eff = target ? (actual / target) * 100 : 0
                const order = open.find((o) => o.id === hrs[0]?.orderId)
                return (
                  <article key={line} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
                    <header className="flex items-baseline justify-between">
                      <h3 className="font-heading text-lg font-semibold">{L ? `লাইন ${bn(line)}` : `line ${line}`}</h3>
                      <span className={`num font-heading text-2xl font-semibold ${eff < 85 ? 'text-alert' : 'text-ok'}`}>{pct(eff, 0)}</span>
                    </header>
                    <p className="text-sm text-muted">
                      {order?.code} · {num(actual)} / {num(target)}
                    </p>
                    <ol className="flex h-16 items-end gap-1" aria-label={`line ${line} hourly output`}>
                      {hrs.map((h) => {
                        const r = h.target ? h.actual / h.target : 0
                        return (
                          <li key={h.id} className="flex flex-1 flex-col items-center gap-1" title={`${dhakaHour(h.hourAt)}:00 · ${h.actual}/${h.target}${h.note ? ` · ${h.note}` : ''}`}>
                            <span className={`w-full rounded-sm ${r < 0.85 ? 'bg-alert' : 'bg-ink-fill'}`} style={{ height: `${Math.max(6, Math.min(100, r * 100)) * 0.48}px` }} />
                            <span className="num text-[10px] text-subtle">{dhakaHour(h.hourAt)}</span>
                          </li>
                        )
                      })}
                    </ol>
                    {hrs.some((h) => h.note) ? <p className="text-xs text-alert">{hrs.filter((h) => h.note).map((h) => h.note).join(' · ')}</p> : null}
                  </article>
                )
              })}
            </div>
          )}
        </Section>

        <Section title={L ? 'এক ঘণ্টার হিসাব দিন' : 'log this hour'}>
          <ActionForm action={logSewing} resetOnSuccess className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="label">{L ? 'অর্ডার' : 'order'}</span>
              <select name="order_id" required className="field">
                {open.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} · {o.style}
                    {o.ppSignedAt ? '' : L ? ' (পিপি স্বাক্ষর হয়নি)' : ' (pp not signed)'}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="label">{L ? 'লাইন' : 'line'}</span>
                <input name="line" type="number" min={1} defaultValue={1} required inputMode="numeric" className="field num h-12 text-lg" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">{L ? 'লক্ষ্য' : 'target'}</span>
                <input name="target" type="number" min={1} defaultValue={110} required inputMode="numeric" className="field num h-12 text-lg" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">{L ? 'প্রকৃত' : 'actual'}</span>
                <input name="actual" type="number" min={0} required inputMode="numeric" className="field num h-12 text-lg" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="label">{L ? 'বন্ধ ছিল (মিনিট)' : 'downtime (min)'}</span>
              <input name="downtime" type="number" min={0} max={60} defaultValue={0} inputMode="numeric" className="field num" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">{L ? 'কারণ' : 'reason'}</span>
              <input name="note" className="field" placeholder={L ? 'যেমন মেশিন নষ্ট, কাপড় আসতে দেরি…' : 'machine down, fabric late…'} />
            </label>
            <Submit>{L ? 'জমা দিন' : 'submit hour'}</Submit>
            {sewable.length < open.length ? (
              <p className="text-xs text-subtle">{L ? 'পিপি মিটিংয়ে স্বাক্ষর না হওয়া অর্ডারের হিসাব গ্রহণ করা হবে না।' : 'orders without a signed pp meeting will be refused.'}</p>
            ) : null}
          </ActionForm>
        </Section>
      </div>
    </>
  )
}
