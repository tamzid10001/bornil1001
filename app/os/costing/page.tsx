import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quotes } from '@/lib/db/schema'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { optionLabel } from '@/lib/config'
import { quoteMargin } from '@/lib/domain'
import { bn, n, pct, tk } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, Empty, ModuleOff, PageHeader, Section } from '@/components/os/ui'
import { createQuote } from '../actions/sales'

export const metadata = { title: 'কস্টিং' }

export default async function CostingPage() {
  const [rows, config, actor] = await Promise.all([db.select().from(quotes).orderBy(desc(quotes.createdAt)), getConfig(), getActor()])
  const can = grantsFor(actor)
  if (!config.modules.costing) return <ModuleOff title="কস্টিং" canChange={can['settings.manage']} />

  return (
    <>
      <PageHeader eyebrow={config.gates.costing ? 'মার্চেন্ডাইজিং · কস্টিং গেট' : 'মার্চেন্ডাইজিং'} title="কস্ট শিট" />

      {can['costing.edit'] ? (
        <details className="rounded-xl border border-rule p-4" open={rows.length === 0}>
          <summary className="font-medium">ইনকোয়ারি ছাড়াই নতুন কস্ট শিট খুলুন</summary>
          <ActionForm action={createQuote} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="flex flex-col gap-1.5">
              <span className="label">ক্রেতা</span>
              <input name="buyer" required className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">স্টাইল</span>
              <input name="style" required className="field" placeholder="যেমন HW-JK-410 প্যাডেড জ্যাকেট" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">পোশাকের ধরন</span>
              <select name="category" required className="field">
                {config.categories.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">পরিমাণ (পিস)</span>
              <input name="quantity" type="number" min={1} required className="field num" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">লক্ষ্য দর (৳ / পিস)</span>
              <input name="target_price" type="number" step="0.01" min={0} required className="field num" />
            </label>
            <div className="sm:col-span-2 lg:col-span-5">
              <Submit>কস্ট শিট খুলুন</Submit>
            </div>
          </ActionForm>
        </details>
      ) : null}

      <Section title="কোটেশন">
        {rows.length === 0 ? (
          <Empty>{config.modules.inquiries ? 'একটি ইনকোয়ারি নিশ্চিত করলে বা ওপরের ফর্ম থেকে কস্ট শিট শুরু হবে।' : 'ওপরের ফর্ম থেকে প্রথম কস্ট শিট খুলুন।'}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-160">
              <thead>
                <tr>
                  <th>কোটেশন</th>
                  <th>ক্রেতা · স্টাইল</th>
                  <th className="text-right">পরিমাণ</th>
                  <th className="text-right">এফওবি</th>
                  <th className="text-right">মার্জিন</th>
                  <th>অবস্থা</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((q) => {
                  const m = quoteMargin(q)
                  const under = config.gates.costing && m.pct < q.floorMargin
                  return (
                    <tr key={q.id}>
                      <td>
                        <Link href={`/os/costing/${q.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                          {q.code}
                        </Link>
                        <span className="ml-1 text-xs text-subtle">সংস্করণ {bn(q.rev)}</span>
                      </td>
                      <td>
                        {q.buyer}
                        <div className="text-xs text-subtle">
                          {q.style} · {optionLabel(config.categories, q.category)}
                        </div>
                      </td>
                      <td className="num text-right">{n(q.quantity)}</td>
                      <td className="num text-right">{tk(q.fob)}</td>
                      <td className={`num text-right ${under ? 'text-alert' : ''}`}>{pct(m.pct)}</td>
                      <td>
                        <Chip status={q.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
