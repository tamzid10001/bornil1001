import Link from 'next/link'
import { db } from '@/lib/db'
import { sewing } from '@/lib/db/schema'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { addDays, optionLabel, today } from '@/lib/config'
import { listOrders, projection } from '@/lib/queries'
import { bn, day, n, tkK } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, Empty, PageHeader, Section, StageRail } from '@/components/os/ui'
import { createOrder } from '../actions/sales'

export const metadata = { title: 'অর্ডার' }

export default async function OrdersPage() {
  const [rows, allSewing, config, actor] = await Promise.all([listOrders(), db.select().from(sewing), getConfig(), getActor()])
  const can = grantsFor(actor)

  return (
    <>
      <PageHeader eyebrow="প্রতিটি অর্ডারের পূর্ণ বিবরণ" title="অর্ডার" />

      {can['order.create'] ? (
        <details className="rounded-xl border border-rule p-4" open={rows.length === 0}>
          <summary className="font-medium">সরাসরি নতুন অর্ডার নিন</summary>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            রিপিট অর্ডার, সাব-কন্ট্রাক্ট বা সিস্টেমের বাইরে কস্টিং হওয়া অর্ডারের জন্য। সাইজ ভাগ, ক্রিটিক্যাল পাথ ও কাঁচামালের তালিকা পোশাকের ধরন অনুযায়ী নিজে থেকেই তৈরি হবে।
          </p>
          <ActionForm action={createOrder} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="flex flex-col gap-1.5">
              <span className="label">ক্রেতা</span>
              <input name="buyer" required className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">স্টাইল</span>
              <input name="style" required className="field" />
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
              <span className="label">কাপড়</span>
              <input name="fabric" className="field" placeholder="যেমন ১২ আউন্স ডেনিম" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">পরিমাণ (পিস)</span>
              <input name="quantity" type="number" min={1} required className="field num" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">পিসপ্রতি দর (৳)</span>
              <input name="fob" type="number" step="0.01" min={0} required className="field num" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">পিসপ্রতি কাপড় (ঐচ্ছিক)</span>
              <input name="fabric_qty" type="number" step="0.001" min={0} className="field num" placeholder="ধরন অনুযায়ী একক" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">শিপমেন্টের তারিখ</span>
              <input name="ship_date" type="date" min={addDays(today(), 1)} defaultValue={addDays(today(), 90)} required className="field" />
            </label>
            {config.modules.commercial ? (
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="label">মাস্টার এলসি / ক্রেতার পিও নম্বর (ঐচ্ছিক)</span>
                <input name="lc_number" className="field" />
              </label>
            ) : null}
            <div className="flex items-end sm:col-span-2">
              <Submit>অর্ডার খুলুন</Submit>
            </div>
          </ActionForm>
        </details>
      ) : null}

      <Section title={`${bn(rows.length)}টি অর্ডার`}>
        {rows.length === 0 ? (
          <Empty>{config.modules.costing ? 'ক্রেতা কোনো কোটেশন নিশ্চিত করলে বা ওপরের ফর্ম থেকে অর্ডার নিলে এখানে দেখা যাবে।' : 'ওপরের ফর্ম থেকে প্রথম অর্ডার নিন।'}</Empty>
        ) : (
          <ul className="flex flex-col">
            {rows.map((o) => {
              const p = projection(o, allSewing.filter((s) => s.orderId === o.id), config.production.shipBufferDays)
              return (
                <li key={o.id} className="border-t border-rule first:border-t-0">
                  <Link href={`/os/orders/${o.id}`} className="group grid gap-3 py-5 md:grid-cols-[12rem_1fr_16rem] md:items-center">
                    <span className="flex flex-col">
                      <span className="font-heading text-lg font-semibold group-hover:text-ink">{o.code}</span>
                      <span className="text-sm text-muted">{o.buyer}</span>
                    </span>
                    <span className="flex flex-col gap-2">
                      <span className="text-sm">
                        {o.style} · {optionLabel(config.categories, o.category)} · {n(o.quantity)} পিস · {tkK(o.quantity * o.fob)}
                      </span>
                      <StageRail stage={o.stage} labels={config.stages} />
                    </span>
                    <span className="flex items-center gap-2 text-sm text-muted md:justify-end">
                      শিপমেন্ট {day(o.shipDate)}
                      {o.closedAt ? <Chip status="closed" /> : p.late ? <Chip status="late" /> : null}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </>
  )
}
