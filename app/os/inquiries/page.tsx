import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { inquiries } from '@/lib/db/schema'
import { day, n, stamp } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, Empty, PageHeader, Section } from '@/components/os/ui'
import { createInquiry } from '../actions/sales'

export const metadata = { title: 'inquiries' }

export default async function InquiriesPage() {
  const rows = await db.select().from(inquiries).orderBy(desc(inquiries.createdAt))
  return (
    <>
      <PageHeader
        eyebrow="merchandising"
        title="Buyer inquiries"
      />
      <div className="grid gap-10 lg:grid-cols-[1fr_24rem]">
        <Section title="inbox">
          {rows.length === 0 ? (
            <Empty>No inquiries yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>inquiry</th>
                    <th>buyer</th>
                    <th>style</th>
                    <th className="text-right">qty</th>
                    <th>ship</th>
                    <th>status</th>
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
        <Section title="log an inquiry">
          <ActionForm action={createInquiry} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="label">buyer</span>
              <input name="buyer" required className="field" placeholder="Nordhavn Apparel" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">from</span>
              <input name="from_email" type="email" className="field" placeholder="sourcing@buyer.com" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">subject</span>
              <input name="subject" className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">email body</span>
              <textarea name="body" required rows={10} className="field font-mono text-sm" placeholder="Please quote for…" />
            </label>
            <Submit>read the email</Submit>
          </ActionForm>
        </Section>
      </div>
    </>
  )
}
