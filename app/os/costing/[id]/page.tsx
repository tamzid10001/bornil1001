import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inquiries, orders, people, quotes } from '@/lib/db/schema'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { addDays, optionLabel, today, unitLabel } from '@/lib/config'
import { quoteCost, quoteMargin } from '@/lib/domain'
import { bn, n, pct, stamp, tk, tkK, input } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, GateNote, ModuleOff, PageHeader, Section, Stat, TextLink } from '@/components/os/ui'
import { ownerDecision, saveQuote, sendQuote, submitQuote, winQuote } from '../../actions/sales'

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const quoteId = Number(id)
  if (!Number.isInteger(quoteId) || quoteId <= 0) notFound()
  const [q] = await db.select().from(quotes).where(eq(quotes.id, quoteId))
  if (!q) notFound()
  const [actor, config, [releaser], [order], [inq]] = await Promise.all([
    getActor(),
    getConfig(),
    q.releasedBy ? db.select().from(people).where(eq(people.id, q.releasedBy)) : Promise.resolve([]),
    db.select().from(orders).where(eq(orders.quoteId, q.id)),
    q.inquiryId ? db.select().from(inquiries).where(eq(inquiries.id, q.inquiryId)) : Promise.resolve([]),
  ])
  const can = grantsFor(actor)
  if (!config.modules.costing) return <ModuleOff title="কস্টিং" canChange={can['settings.manage']} />

  const unit = unitLabel(q.fabricUnit)
  const inputs = [
    { name: 'fabric_qty', value: q.fabricQty, label: 'কাপড়ের ব্যবহার', unit: `${unit} / পিস`, step: '0.001' },
    { name: 'fabric_rate', value: input(q.fabricRate), label: 'কাপড়ের দর', unit: `৳ / ${unit}`, step: '0.01' },
    { name: 'cm_minutes', value: q.cmMinutes, label: 'স্ট্যান্ডার্ড মিনিট (এসএমভি)', unit: 'মিনিট / পিস', step: '0.1' },
    { name: 'cm_rate', value: input(q.cmRate), label: 'প্রতি মিনিটে সিএম খরচ', unit: '৳ / মিনিট', step: '0.01' },
    { name: 'trims', value: input(q.trims), label: 'ট্রিমস ও অ্যাকসেসরিজ', unit: '৳ / পিস', step: '0.01' },
    { name: 'overhead', value: input(q.overhead), label: 'ওভারহেড, ওয়াশ, পরীক্ষা ও পরিবহন', unit: '৳ / পিস', step: '0.01' },
    { name: 'fob', value: input(q.fob), label: 'ক্রেতার জন্য এফওবি দর', unit: '৳ / পিস', step: '0.01' },
  ]
  const c = quoteCost(q)
  const m = quoteMargin(q)
  const gated = config.gates.costing
  const under = gated && m.pct < q.floorMargin
  const editable = can['costing.edit'] && (q.status === 'draft' || q.status === 'held' || q.status === 'released')
  const parts = [
    { label: 'কাপড়', v: c.fabric },
    { label: 'কাটিং ও মেকিং', v: c.cm },
    { label: 'ট্রিমস', v: c.trims },
    { label: 'ওভারহেড', v: c.overhead },
  ]
  const shipDefault = inq?.shipDate && inq.shipDate > today() ? inq.shipDate : addDays(today(), 90)

  return (
    <>
      <PageHeader
        eyebrow={`${q.code} · সংস্করণ ${bn(q.rev)} · ${optionLabel(config.categories, q.category)}`}
        title={`${q.buyer}-এর জন্য ${q.style}`}
        lede={`${n(q.quantity)} পিস · অর্ডার মূল্য ${tkK(q.quantity * q.fob)}`}
        actions={<Chip status={q.status} />}
      />

      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={tk(m.cost)} label="পিসপ্রতি খরচ" />
        <Stat value={tk(q.fob)} label="পিসপ্রতি এফওবি" />
        <Stat value={pct(m.pct)} label={gated ? `মার্জিন · ন্যূনতম ${pct(q.floorMargin, 0)}` : 'মার্জিন'} tone={under ? 'alert' : 'ok'} />
        <Stat value={tkK(m.margin * q.quantity)} label="অর্ডারে মোট মার্জিন" tone={m.margin < 0 ? 'alert' : undefined} />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section title="কস্ট শিট">
          <ActionForm action={saveQuote} className="flex flex-col gap-4">
            <input type="hidden" name="id" value={q.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              {inputs.map((i) => (
                <label key={i.name} className="flex flex-col gap-1.5">
                  <span className="label">{i.label}</span>
                  <span className="flex items-center gap-2">
                    <input name={i.name} type="number" step={i.step} min="0" defaultValue={i.value} disabled={!editable} required className="field num" />
                    <span className="shrink-0 text-xs text-subtle">{i.unit}</span>
                  </span>
                </label>
              ))}
            </div>
            {editable ? (
              <div className="flex flex-wrap gap-3">
                <Submit quiet>{q.status !== 'draft' ? 'নতুন সংস্করণ হিসেবে সংরক্ষণ করুন' : 'সংরক্ষণ করুন'}</Submit>
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

        <Section title={gated ? 'গেট' : 'পরবর্তী ধাপ'}>
          {gated ? (
            <GateNote gate="costing" open={!under || q.status === 'released' || q.status === 'sent' || q.status === 'won'}>
              {under
                ? `মার্জিন ${pct(m.pct)}, যা ন্যূনতম ${pct(q.floorMargin, 0)}-এর নিচে। কস্টিং গেট ছাড়ের অনুমতি আছে এমন কেউ লিখিত কারণসহ এটি ছাড় দিতে পারেন।`
                : `মার্জিন ন্যূনতম ${pct(q.floorMargin, 0)} পার করেছে।`}
            </GateNote>
          ) : null}

          {q.status === 'draft' && can['costing.edit'] ? (
            <ActionForm action={submitQuote}>
              <input type="hidden" name="id" value={q.id} />
              <Submit>{gated ? 'ছাড়ের জন্য জমা দিন' : 'চূড়ান্ত করুন'}</Submit>
            </ActionForm>
          ) : null}

          {q.status === 'held' ? (
            can['gate.costing'] ? (
              <ActionForm action={ownerDecision} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
                <input type="hidden" name="id" value={q.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="label">কেন এই মার্জিন গ্রহণযোগ্য</span>
                  <textarea name="reason" rows={3} className="field" placeholder="যেমন গুরুত্বপূর্ণ ক্রেতা; মন্দার মাসে লাইন চালু রাখবে" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Submit name="decision" value="release">
                    ন্যূনতমের নিচে হলেও ছাড় দিন
                  </Submit>
                  <Submit quiet name="decision" value="return">
                    ফেরত পাঠান
                  </Submit>
                </div>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">অনুমোদনের অপেক্ষায়। সিদ্ধান্ত নিতে “বর্তমান ব্যবহারকারী” থেকে কস্টিং গেট ছাড়ের অনুমতি আছে এমন কাউকে বেছে নিন।</p>
            )
          ) : null}

          {q.status === 'released' ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                ছাড় দিয়েছেন {releaser?.name ?? '—'} · {stamp(q.releasedAt)}
              </p>
              {can['costing.edit'] ? (
                <ActionForm action={sendQuote}>
                  <input type="hidden" name="id" value={q.id} />
                  <Submit>ক্রেতাকে পাঠান</Submit>
                </ActionForm>
              ) : null}
            </div>
          ) : null}

          {q.status === 'sent' && can['order.create'] ? (
            <ActionForm action={winQuote} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
              <p className="text-sm text-muted">পাঠানো হয়েছে: {stamp(q.sentAt)}। ক্রেতা নিশ্চিত করলে অর্ডার খুলুন।</p>
              <input type="hidden" name="id" value={q.id} />
              <label className="flex flex-col gap-1.5">
                <span className="label">{config.modules.commercial ? 'মাস্টার এলসি / ক্রেতার পিও নম্বর' : 'ক্রেতার পিও নম্বর (ঐচ্ছিক)'}</span>
                <input name="lc_number" required={config.modules.commercial} className="field" placeholder="LC-NHA-26-0412" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">শিপমেন্টের তারিখ</span>
                <input name="ship_date" type="date" min={addDays(today(), 1)} defaultValue={shipDefault} required className="field" />
              </label>
              <Submit>ক্রেতা নিশ্চিত করেছে — অর্ডার খুলুন</Submit>
            </ActionForm>
          ) : null}

          {order ? (
            <p className="text-sm text-muted">
              অর্ডার পাওয়া গেছে — <TextLink href={`/os/orders/${order.id}`}>{order.code}</TextLink> নামে চলছে।
            </p>
          ) : null}
        </Section>
      </div>
    </>
  )
}
