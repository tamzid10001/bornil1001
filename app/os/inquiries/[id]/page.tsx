import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inquiries, quotes } from '@/lib/db/schema'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { bn, stamp, input } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, PageHeader, Section, TextLink } from '@/components/os/ui'
import { confirmInquiry } from '../../actions/sales'

export default async function InquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const inquiryId = Number(id)
  if (!Number.isInteger(inquiryId) || inquiryId <= 0) notFound()
  const [inq] = await db.select().from(inquiries).where(eq(inquiries.id, inquiryId))
  if (!inq) notFound()
  const [[quote], config, actor] = await Promise.all([db.select().from(quotes).where(eq(quotes.inquiryId, inq.id)), getConfig(), getActor()])
  const canConfirm = grantsFor(actor)['inquiry.manage']
  const field = (k: string) => inq.fields.find((f) => f.key === k)
  const locked = inq.status !== 'draft'

  return (
    <>
      <PageHeader
        eyebrow={`${inq.code} · ${stamp(inq.createdAt)}`}
        title={inq.subject || `${inq.buyer}-এর ইনকোয়ারি`}
        lede={`${inq.buyer}${inq.fromEmail ? ` · ${inq.fromEmail}` : ''}`}
        actions={<Chip status={inq.status} />}
      />
      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="ইমেইল">
          <pre className="whitespace-pre-wrap rounded-xl bg-key p-5 font-mono text-sm leading-relaxed">{inq.body}</pre>
        </Section>
        <Section title={locked ? 'নিশ্চিত করা তথ্য' : 'ইমেইল থেকে পাওয়া তথ্য যাচাই করুন'}>
          <ul className="flex flex-col">
            {inq.fields.map((f) => (
              <li key={f.key} className="flex items-baseline gap-3 border-t border-rule py-2.5 first:border-t-0">
                <span className="w-32 shrink-0 text-sm text-muted">{f.label}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={f.value ? 'font-medium' : 'text-alert'}>{f.value ?? 'পাওয়া যায়নি'}</span>
                  {f.source ? <span className="truncate text-xs text-subtle">{`"${f.source}"`}</span> : null}
                </span>
                <span className={`num text-xs ${f.confidence < 0.7 ? 'text-alert' : 'text-ok'}`}>
                  <span className="sr-only">নিশ্চয়তা </span>
                  {bn(Math.round(f.confidence * 100))}%
                </span>
              </li>
            ))}
          </ul>
          {locked ? (
            quote ? (
              <p className="text-sm text-muted">
                নিশ্চিত করা হয়েছে — কস্টিং চলছে <TextLink href={`/os/costing/${quote.id}`}>{quote.code}</TextLink> নামে।
              </p>
            ) : null
          ) : !canConfirm ? (
            <p className="text-sm text-muted">যাচাইয়ের অপেক্ষায়।</p>
          ) : (
            <ActionForm action={confirmInquiry} className="flex flex-col gap-4 rounded-xl border border-rule p-5">
              <input type="hidden" name="id" value={inq.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="label">স্টাইল</span>
                  <input name="style" defaultValue={inq.style ?? ''} required className="field" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">পোশাকের ধরন</span>
                  <select name="category" defaultValue={inq.category ?? config.categories[0].key} required className="field">
                    {config.categories.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">কাপড়</span>
                  <input name="fabric" defaultValue={inq.fabric ?? ''} className="field" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">পরিমাণ (পিস)</span>
                  <input name="quantity" type="number" defaultValue={inq.quantity ?? ''} required className="field num" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">শিপমেন্টের তারিখ</span>
                  <input name="ship_date" type="date" defaultValue={inq.shipDate ?? field('shipDate')?.value ?? ''} required className="field" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">লক্ষ্য এফওবি (৳ / পিস)</span>
                  <input name="target_price" type="number" step="0.01" defaultValue={input(inq.targetPrice)} required className="field num" />
                </label>
              </div>
              <Submit>নিশ্চিত করে কস্টিং শুরু করুন</Submit>
            </ActionForm>
          )}
        </Section>
      </div>
    </>
  )
}
