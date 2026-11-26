import type { BondEntry, Order } from '@/lib/db/schema'
import { today, unitLabel } from '@/lib/config'
import { day, n } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Empty, Section } from '@/components/os/ui'
import { bondEntry } from '@/app/os/actions/export'

export function BondSection({
  order,
  ud,
  entries,
  nameOf,
  canWrite: allowed,
}: {
  order: Order
  ud: { id: number; number: string; material: string; permittedQty: number; permittedUnit: string } | undefined
  entries: BondEntry[]
  nameOf: (id: number | null) => string
  canWrite: boolean
}) {
  const received = entries.filter((e) => e.kind === 'in').reduce((s, e) => s + e.qty, 0)
  const issued = entries.filter((e) => e.kind === 'out').reduce((s, e) => s + e.qty, 0)
  const canWrite = allowed && !order.closedAt
  const unit = unitLabel(ud?.permittedUnit ?? 'kg')
  let balance = 0

  return (
    <Section
      title="বন্ডেড গুদাম"
      aside={ud ? <span className="text-sm text-muted">ইউডি {ud.number}</span> : null}
    >
      {!ud ? (
        <Empty>ইউডি ইস্যু হলে এখানে বন্ডের হিসাব শুরু হবে। ইউডি ছাড়া শুল্কমুক্ত কাঁচামাল গুদামে ঢোকানো যায় না।</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <Figure label={`ইউডিতে অনুমোদিত ${ud.material}`} value={`${n(ud.permittedQty)} ${unit}`} />
            <Figure label="বন্ডে গ্রহণ" value={`${n(received)} ${unit}`} tone={received > ud.permittedQty ? 'alert' : undefined} />
            <Figure label="ফ্লোরে দেওয়া" value={`${n(issued)} ${unit}`} />
            <Figure label="গুদামে আছে" value={`${n(received - issued)} ${unit}`} />
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-key" role="img" aria-label={`অনুমোদিত পরিমাণের ${n((received / ud.permittedQty) * 100)}% গ্রহণ করা হয়েছে`}>
            <div className="h-full bg-foreground" style={{ width: `${Math.min(100, (received / ud.permittedQty) * 100)}%` }} />
          </div>

          {entries.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-rule text-left text-muted">
                    <th className="py-2 pr-3 font-normal">তারিখ</th>
                    <th className="py-2 pr-3 font-normal">কাঁচামাল</th>
                    <th className="py-2 pr-3 font-normal">সূত্র</th>
                    <th className="py-2 pr-3 text-right font-normal">গ্রহণ</th>
                    <th className="py-2 pr-3 text-right font-normal">ইস্যু</th>
                    <th className="py-2 text-right font-normal">স্থিতি</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    balance += e.kind === 'in' ? e.qty : -e.qty
                    return (
                      <tr key={e.id} className="border-b border-rule">
                        <td className="py-2 pr-3">{day(e.on)}</td>
                        <td className="py-2 pr-3">
                          {e.material}
                          <span className="block text-xs text-muted">{nameOf(e.createdBy)}</span>
                        </td>
                        <td className="py-2 pr-3 text-muted">{e.ref}</td>
                        <td className="num py-2 pr-3 text-right">{e.kind === 'in' ? n(e.qty) : ''}</td>
                        <td className="num py-2 pr-3 text-right">{e.kind === 'out' ? n(e.qty) : ''}</td>
                        <td className="num py-2 text-right font-medium">{n(balance)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>এখনো কোনো কাঁচামাল বন্ডে আসেনি।</Empty>
          )}

          {canWrite ? (
            <ActionForm action={bondEntry} resetOnSuccess className="flex flex-col gap-3 rounded-xl border border-rule p-4">
              <input type="hidden" name="order_id" value={order.id} />
              <fieldset className="flex gap-4 text-sm">
                <legend className="sr-only">হিসাবের ধরন</legend>
                <label className="flex items-center gap-2">
                  <input type="radio" name="kind" value="in" defaultChecked /> বন্ডে গ্রহণ
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="kind" value="out" /> ফ্লোরে ইস্যু
                </label>
              </fieldset>
              <div className="grid gap-3 sm:grid-cols-4">
                <input name="material" required className="field sm:col-span-2" placeholder="যেমন ৩০/১ কম্বড কটন সুতা" aria-label="কাঁচামাল" defaultValue={order.fabric ?? ''} />
                <input name="qty" type="number" step="0.1" min={0.1} required className="field num" placeholder={unit} aria-label={`পরিমাণ (${unit})`} />
                <input name="on" type="date" required defaultValue={today()} max={today()} className="field" aria-label="তারিখ" />
              </div>
              <input name="ref" required className="field" placeholder="বিল অব এন্ট্রি / চালান / ইস্যু স্লিপ নং" aria-label="সূত্র" />
              <div>
                <Submit small>হিসাব লিখুন</Submit>
              </div>
            </ActionForm>
          ) : null}
        </>
      )}
    </Section>
  )
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: 'alert' }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`num text-lg font-medium ${tone === 'alert' ? 'text-alert' : ''}`}>{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  )
}
