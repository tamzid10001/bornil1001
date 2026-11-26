import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { orders, people, quotes } from '@/lib/db/schema'
import { getActor } from '@/lib/actor'
import { canPass, quoteCost, quoteMargin } from '@/lib/domain'
import { bn, n, pct, stamp, tk, tkK, input } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, GateNote, PageHeader, Section, Stat, TextLink } from '@/components/os/ui'
import { ownerDecision, saveQuote, sendQuote, submitQuote, winQuote } from '../../actions/sales'

const INPUTS = [
  { name: 'fabric_kg', key: 'fabricKg', label: 'কাপড়ের খরচ', unit: 'কেজি / পিস', step: '0.01', money: false },
  { name: 'fabric_rate', key: 'fabricRate', label: 'কাপড়ের দর', unit: '৳ / কেজি', step: '0.01', money: true },
  { name: 'cm_minutes', key: 'cmMinutes', label: 'স্ট্যান্ডার্ড মিনিট (এসএমভি)', unit: 'মিনিট / পিস', step: '0.1', money: false },
  { name: 'cm_rate', key: 'cmRate', label: 'প্রতি মিনিটে সিএম খরচ', unit: '৳ / মিনিট', step: '0.01', money: true },
  { name: 'trims', key: 'trims', label: 'ট্রিমস ও এক্সেসরিজ', unit: '৳ / পিস', step: '0.01', money: true },
  { name: 'overhead', key: 'overhead', label: 'ওভারহেড, ওয়াশ, টেস্ট, ফ্রেইট', unit: '৳ / পিস', step: '0.01', money: true },
  { name: 'fob', key: 'fob', label: 'বায়ারকে এফওবি দর', unit: '৳ / পিস', step: '0.01', money: true },
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
    { label: 'কাপড়', v: c.fabric },
    { label: 'কাটিং ও মেকিং', v: c.cm },
    { label: 'ট্রিমস', v: c.trims },
    { label: 'ওভারহেড', v: c.overhead },
  ]

  return (
    <>
      <PageHeader
        eyebrow={`${q.code} · সংশোধন ${bn(q.rev)}`}
        title={`${q.buyer}-এর জন্য ${q.style}`}
        lede={`${n(q.quantity)} পিস · অর্ডার মূল্য ${tkK(q.quantity * q.fob)}`}
        actions={<Chip status={q.status} />}
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={tk(m.cost)} label="প্রতি পিস খরচ" />
        <Stat value={tk(q.fob)} label="প্রতি পিস এফওবি" />
        <Stat value={pct(m.pct)} label={`মার্জিন · ন্যূনতম ${pct(q.floorMargin, 0)}`} tone={under ? 'alert' : 'ok'} />
        <Stat value={tkK(m.margin * q.quantity)} label="অর্ডারে মোট মার্জিন" tone={m.margin < 0 ? 'alert' : undefined} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section title="কস্ট শিট">
          <ActionForm action={saveQuote} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={q.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              {INPUTS.map((i) => (
                <label key={i.name} className="flex flex-col gap-1.5">
                  <span className="label">{i.label}</span>
                  <span className="flex items-center gap-2">
                    <input name={i.name} type="number" step={i.step} min="0" defaultValue={i.money ? input(q[i.key]) : q[i.key]} disabled={!editable} required className="field num" />
                    <span className="shrink-0 text-xs text-subtle">{i.unit}</span>
                  </span>
                </label>
              ))}
            </div>
            {editable ? (
              <div className="flex flex-wrap gap-3">
                <Submit quiet>{q.status !== 'draft' ? 'নতুন সংশোধন হিসেবে সংরক্ষণ' : 'সংরক্ষণ'}</Submit>
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
                  {p.label} <span className="num text-foreground">{tk(p.v)}</span>
                </li>
              ))}
              <li>
                মার্জিন <span className={`num ${under ? 'text-alert' : 'text-foreground'}`}>{tk(m.margin)}</span>
              </li>
            </ul>
          </div>
        </Section>

        <Section title="গেট">
          <GateNote gate="costing" open={!under || q.status === 'released' || q.status === 'sent' || q.status === 'won'}>
            {under
              ? `${pct(m.pct)}, যা ন্যূনতম ${pct(q.floorMargin, 0)}-এর নিচে। শুধু মালিক লিখিত কারণসহ এটি ছাড় দিতে পারেন।`
              : `মার্জিন ন্যূনতম ${pct(q.floorMargin, 0)} পার করেছে।`}
          </GateNote>

          {q.status === 'draft' ? (
            <ActionForm action={submitQuote}>
              <input type="hidden" name="id" value={q.id} />
              <Submit>ছাড়ের জন্য জমা দিন</Submit>
            </ActionForm>
          ) : null}

          {q.status === 'held' ? (
            ownerCan ? (
              <ActionForm action={ownerDecision} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
                <input type="hidden" name="id" value={q.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="label">কেন এই মার্জিন গ্রহণযোগ্য</span>
                  <textarea name="reason" rows={3} className="field" placeholder="গুরুত্বপূর্ণ বায়ার, মন্দা মাসে লাইন ৩ চালু রাখবে" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Submit name="decision" value="release">
                    ন্যূনতমের নিচে ছাড় দিন
                  </Submit>
                  <Submit quiet name="decision" value="return">
                    ফেরত পাঠান
                  </Submit>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">মালিকের অপেক্ষায়। সিদ্ধান্ত নিতে “যিনি কাজ করছেন” থেকে মালিক বেছে নিন।</p>
            )
          ) : null}

          {q.status === 'released' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                ছাড় দিয়েছেন {releaser?.name ?? '—'} · {stamp(q.releasedAt)}
              </p>
              <ActionForm action={sendQuote}>
                <input type="hidden" name="id" value={q.id} />
                <Submit>বায়ারকে পাঠান</Submit>
              </ActionForm>
            </div>
          ) : null}

          {q.status === 'sent' ? (
            <ActionForm action={winQuote} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
              <p className="text-sm text-muted">পাঠানো হয়েছে {stamp(q.sentAt)}। বায়ার নিশ্চিত করলে অর্ডার খুলুন।</p>
              <input type="hidden" name="id" value={q.id} />
              <label className="flex flex-col gap-1.5">
                <span className="label">মাস্টার এলসি / বায়ার পিও নম্বর</span>
                <input name="lc_number" required className="field" placeholder="LC-NHA-26-0412" />
              </label>
              <Submit>বায়ার নিশ্চিত করেছে — অর্ডার খুলুন</Submit>
            </ActionForm>
          ) : null}

          {order ? (
            <p className="text-sm text-muted">
              অর্ডার পাওয়া গেছে। চলছে <TextLink href={`/os/orders/${order.id}`}>{order.code}</TextLink> হিসেবে।
            </p>
          ) : null}
        </Section>
      </div>
    </>
  )
}
