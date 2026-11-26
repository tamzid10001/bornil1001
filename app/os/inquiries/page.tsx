import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inquiries } from '@/lib/db/schema'
import { day, n, stamp } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, Empty, PageHeader, Section } from '@/components/os/ui'
import { createInquiry } from '../actions/sales'

export const metadata = { title: 'ইনকোয়ারি' }

export default async function InquiriesPage() {
  const rows = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt))
  return (
    <>
      <PageHeader
        eyebrow="মার্চেন্ডাইজিং"
        title="বায়ারের ইনকোয়ারি"
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        <Section title="ইনবক্স">
          {rows.length === 0 ? (
            <Empty>এখনো কোনো ইনকোয়ারি নেই।</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>ইনকোয়ারি</th>
                    <th>বায়ার</th>
                    <th>স্টাইল</th>
                    <th className="text-right">পরিমাণ</th>
                    <th>শিপমেন্ট</th>
                    <th>অবস্থা</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/os/inquiries/${r.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                          {r.code}
                        </Link>
                        <div className="text-xs text-subtle">{stamp(r.createdAt)}</div>
                      </td>
                      <td>{r.buyer}</td>
                      <td>{r.style ?? '—'}</td>
                      <td className="num text-right">{n(r.quantity)}</td>
                      <td>{day(r.shipDate)}</td>
                      <td>
                        <Chip status={r.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section title="নতুন ইনকোয়ারি লিখুন">
          <ActionForm action={createInquiry} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="label">বায়ার</span>
              <input name="buyer" required className="field" placeholder="Nordhavn Apparel" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">প্রেরক</span>
              <input name="from_email" type="email" className="field" placeholder="sourcing@buyer.com" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">বিষয়</span>
              <input name="subject" className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">ইমেইলের লেখা</span>
              <textarea name="body" required rows={10} className="field font-mono text-sm" placeholder="অনুগ্রহ করে দর দিন…" />
            </label>
            <Submit>ইমেইল পড়ুন</Submit>
          </ActionForm>
        </Section>
      </div>
    </>
  )
}
