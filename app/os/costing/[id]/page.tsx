import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, people, quotes } from '@/lib/db/schema'
import { getActor } from '@/lib/actor'
import { canPass, quoteCost, quoteMargin } from '@/lib/domain'
import { n, pct, stamp, usd, usdK } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, GateNote, PageHeader, Section, Stat, TextLink } from '@/components/os/ui'
import { ownerDecision, saveQuote, sendQuote, submitQuote, winQuote } from '../../actions/sales'

const INPUTS = [
  { name: 'fabric_kg', key: 'fabricKg', label: 'fabric consumption', unit: 'kg / pc', step: '0.001' },
  { name: 'fabric_rate', key: 'fabricRate', label: 'fabric rate', unit: 'usd / kg', step: '0.01' },
  { name: 'cm_minutes', key: 'cmMinutes', label: 'standard minutes (smv)', unit: 'min / pc', step: '0.1' },
  { name: 'cm_rate', key: 'cmRate', label: 'cm cost per minute', unit: 'usd / min', step: '0.001' },
  { name: 'trims', key: 'trims', label: 'trims & accessories', unit: 'usd / pc', step: '0.01' },
  { name: 'overhead', key: 'overhead', label: 'overhead, wash, test, freight', unit: 'usd / pc', step: '0.01' },
  { name: 'fob', key: 'fob', label: 'fob price to buyer', unit: 'usd / pc', step: '0.01' },
] as const

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [q] = await db.select().from(quotes).where(eq(quotes.id, Number(id)))
  if (!q) notFound()
  const [actor, [releaser], [order]] = await Promise.all([
    getActor(),
    q.releasedBy ? db.select().from(people).where(eq(people.id, q.releasedBy)) : Promise.resolve([]),
    db.select().from(orders).where(eq(orders.quoteId, q.id)),
  ])
  const c = quoteCost(q)
  const m = quoteMargin(q)
  const under = m.pct < q.floorMargin
  const editable = q.status === 'draft' || q.status === 'held' || q.status === 'released'
  const ownerCan = canPass('costing', actor?.role)
  const parts = [
    { label: 'fabric', v: c.fabric },
    { label: 'cut & make', v: c.cm },
    { label: 'trims', v: c.trims },
    { label: 'overhead', v: c.overhead },
  ]

  return (
    <>
      <PageHeader
        eyebrow={`${q.code} · rev ${q.rev}`}
        title={`${q.style} for ${q.buyer}`}
        lede={`${n(q.quantity)} pcs · order value ${usdK(q.quantity * q.fob)}`}
        actions={<Chip status={q.status} />}
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={usd(m.cost)} label="cost per piece" />
        <Stat value={usd(q.fob)} label="fob per piece" />
        <Stat value={pct(m.pct)} label={`margin · floor ${pct(q.floorMargin, 0)}`} tone={under ? 'alert' : 'ok'} />
        <Stat value={usdK(m.margin * q.quantity)} label="margin on the order" tone={m.margin < 0 ? 'alert' : undefined} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section title="cost sheet">
          <ActionForm action={saveQuote} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={q.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              {INPUTS.map((i) => (
                <label key={i.name} className="flex flex-col gap-1.5">
                  <span className="label">{i.label}</span>
                  <span className="flex items-center gap-2">
                    <input name={i.name} type="number" step={i.step} min="0" defaultValue={q[i.key]} disabled={!editable} required className="field num" />
                    <span className="shrink-0 text-xs text-subtle">{i.unit}</span>
                  </span>
                </label>
              ))}
            </div>
            {editable ? (
              <div className="flex flex-wrap gap-3">
                <Submit quiet>save{q.status !== 'draft' ? ' as new revision' : ''}</Submit>
              </div>
            ) : null}
          </ActionForm>

          <div className="flex flex-col gap-2">
            <div className="flex h-3 overflow-hidden rounded-full bg-key" aria-hidden="true">
              {parts.map((p, i) => (
                <div key={p.label} className={i === 0 ? 'bg-ink-fill' : i === 1 ? 'bg-ink-fill/60' : i === 2 ? 'bg-ink-fill/35' : 'bg-ink-fill/15'} style={{ width: `${q.fob ? (p.v / q.fob) * 100 : 0}%` }} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {parts.map((p) => (
                <li key={p.label}>
                  {p.label} <span className="num text-foreground">{usd(p.v)}</span>
                </li>
              ))}
              <li>
                margin <span className={`num ${under ? 'text-alert' : 'text-foreground'}`}>{usd(m.margin)}</span>
              </li>
            </ul>
          </div>
        </Section>

        <Section title="the gate">
          <GateNote gate="costing" open={!under || q.status === 'released' || q.status === 'sent' || q.status === 'won'}>
            {under
              ? `${pct(m.pct)} is under the ${pct(q.floorMargin, 0)} floor. only the owner can release it, with a written reason.`
              : `margin clears the ${pct(q.floorMargin, 0)} floor.`}
          </GateNote>

          {q.status === 'draft' ? (
            <ActionForm action={submitQuote}>
              <input type="hidden" name="id" value={q.id} />
              <Submit>submit for release</Submit>
            </ActionForm>
          ) : null}

          {q.status === 'held' ? (
            ownerCan ? (
              <ActionForm action={ownerDecision} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
                <input type="hidden" name="id" value={q.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="label">why this margin is acceptable</span>
                  <textarea name="reason" rows={3} className="field" placeholder="strategic buyer, fills line 3 in a slow month" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Submit name="decision" value="release">
                    release below floor
                  </Submit>
                  <Submit quiet name="decision" value="return">
                    send back
                  </Submit>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Waiting for the owner. Switch “acting as” to the owner to decide.</p>
            )
          ) : null}

          {q.status === 'released' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                Released by {releaser?.name ?? '—'} · {stamp(q.releasedAt)}
              </p>
              <ActionForm action={sendQuote}>
                <input type="hidden" name="id" value={q.id} />
                <Submit>send to buyer</Submit>
              </ActionForm>
            </div>
          ) : null}

          {q.status === 'sent' ? (
            <ActionForm action={winQuote} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
              <p className="text-sm text-muted">Sent {stamp(q.sentAt)}. When the buyer confirms, open the order.</p>
              <input type="hidden" name="id" value={q.id} />
              <label className="flex flex-col gap-1.5">
                <span className="label">master lc / buyer po number</span>
                <input name="lc_number" required className="field" placeholder="LC-NHA-26-0412" />
              </label>
              <Submit>buyer confirmed — open the order</Submit>
            </ActionForm>
          ) : null}

          {order ? (
            <p className="text-sm text-muted">
              Won. Running as <TextLink href={`/os/orders/${order.id}`}>{order.code}</TextLink>.
            </p>
          ) : null}
        </Section>
      </div>
    </>
  )
}
