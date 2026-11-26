import type { Lc, Order } from '@/lib/db/schema'
import { pct, tk, input } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Section } from '@/components/os/ui'
import { realiseOrder } from '@/app/os/actions/orders'

export async function MoneyIn({ order, lcs }: { order: Order; lcs: Lc[] }) {
  const expected = order.quantity * order.fob
  const btb = lcs.filter((l) => l.kind === 'btb' && l.status === 'opened').reduce((s, l) => s + l.amount, 0)

  if (order.closedAt) {
    const realised = order.realisedAmount ?? 0
    // Orders closed before source tax and the Central Fund were recorded have no amount to show.
    const deductions = [
      { label: 'উৎসে কর', v: order.sourceTax },
      { label: 'কেন্দ্রীয় তহবিল', v: order.centralFund },
      { label: 'বিটুবি এলসি পরিশোধ', v: order.btbSettled ?? 0 },
      { label: 'আকাশপথে পরিবহন খরচ', v: order.airFreight ?? 0 },
      { label: 'ক্রেতার ছাড় / দাবি', v: order.discount ?? 0 },
    ].filter((d): d is { label: string; v: number } => d.v != null)
    const net = realised - deductions.reduce((s, d) => s + d.v, 0)
    const rows = [
      { label: 'এফওবি অনুযায়ী প্রত্যাশিত', v: expected },
      { label: 'ব্যাংকে আসা রপ্তানি মূল্য', v: realised },
      ...deductions.map((d) => ({ label: d.label, v: -d.v })),
    ]
    return (
      <Section title="অর্ডারে প্রকৃত লাভ কত হলো">
        <dl className="flex max-w-md flex-col">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between border-t border-rule py-2 text-sm first:border-t-0">
              <dt className="text-muted">{r.label}</dt>
              <dd className={`num ${r.v < 0 ? 'text-alert' : ''}`}>{tk(r.v)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t-2 border-foreground py-2 font-medium">
            <dt>কারখানার নিট আয়</dt>
            <dd className="num">
              {tk(net)} <span className="text-sm text-muted">· {pct(realised ? (net / realised) * 100 : 0)}</span>
            </dd>
          </div>
        </dl>
      </Section>
    )
  }

  if (order.stage !== 'ship') return null

  return (
    <Section title="টাকা প্রাপ্তি">
      <ActionForm action={realiseOrder} className="flex flex-col gap-4">
        <input type="hidden" name="order_id" value={order.id} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'realised', label: 'প্রাপ্ত রপ্তানি মূল্য (৳)', v: expected },
            { name: 'btb_settled', label: 'বিটুবি পরিশোধ (৳)', v: btb },
            { name: 'air_freight', label: 'আকাশপথে পরিবহন খরচ (৳)', v: 0 },
            { name: 'discount', label: 'ছাড় / দাবি (৳)', v: 0 },
          ].map((f) => (
            <label key={f.name} className="flex flex-col gap-1.5">
              <span className="label">{f.label}</span>
              <input name={f.name} type="number" step="0.01" min="0" defaultValue={input(f.v)} required className="field num" />
            </label>
          ))}
        </div>
        <Submit>হিসাব লিখে অর্ডার বন্ধ করুন</Submit>
      </ActionForm>
    </Section>
  )
}
