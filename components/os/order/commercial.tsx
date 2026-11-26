import type { Lc, Order } from '@/lib/db/schema'
import { pct, usd } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Section } from '@/components/os/ui'
import { realiseOrder } from '@/app/os/actions/orders'

export function MoneyIn({ order, lcs }: { order: Order; lcs: Lc[] }) {
  const expected = order.quantity * order.fob
  const btb = lcs.filter((l) => l.kind === 'btb' && l.status === 'opened').reduce((s, l) => s + l.amount, 0)

  if (order.closedAt) {
    const realised = order.realisedAmount ?? 0
    const costs = (order.btbSettled ?? 0) + (order.airFreight ?? 0) + (order.discount ?? 0)
    const net = realised - costs
    const rows = [
      { label: 'expected at fob', v: expected },
      { label: 'realised from the bank', v: realised },
      { label: 'btb lcs settled', v: -(order.btbSettled ?? 0) },
      { label: 'air freight', v: -(order.airFreight ?? 0) },
      { label: 'buyer discount / claim', v: -(order.discount ?? 0) },
    ]
    return (
      <Section title="what the order really made">
        <dl className="flex max-w-md flex-col">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between border-t border-rule py-2 text-sm first:border-t-0">
              <dt className="text-muted">{r.label}</dt>
              <dd className={`num ${r.v < 0 ? 'text-alert' : ''}`}>{usd(r.v)}</dd>
            </div>
          ))}
          <div className="flex justify-between border-t-2 border-foreground py-2 font-medium">
            <dt>net to the factory</dt>
            <dd className="num">
              {usd(net)} <span className="text-sm text-muted">· {pct(realised ? (net / realised) * 100 : 0)}</span>
            </dd>
          </div>
        </dl>
      </Section>
    )
  }

  if (order.stage !== 'ship') return null

  return (
    <Section title="realisation">
      <ActionForm action={realiseOrder} className="flex flex-col gap-4">
        <input type="hidden" name="order_id" value={order.id} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'realised', label: 'realised (usd)', v: expected },
            { name: 'btb_settled', label: 'btb settled (usd)', v: btb },
            { name: 'air_freight', label: 'air freight (usd)', v: 0 },
            { name: 'discount', label: 'discount / claim (usd)', v: 0 },
          ].map((f) => (
            <label key={f.name} className="flex flex-col gap-1.5">
              <span className="label">{f.label}</span>
              <input name={f.name} type="number" step="0.01" min="0" defaultValue={Math.round(f.v * 100) / 100} required className="field num" />
            </label>
          ))}
        </div>
        <Submit>record and close the order</Submit>
      </ActionForm>
    </Section>
  )
}
