import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quotes } from '@/lib/db/schema'
import { quoteMargin } from '@/lib/domain'
import { bn, n, pct, tk } from '@/lib/format'
import { Chip, Empty, PageHeader, Section } from '@/components/os/ui'

export const metadata = { title: 'কস্টিং' }

export default async function CostingPage() {
  const rows = await db.select().from(quotes).orderBy(desc(quotes.createdAt))
  return (
    <>
      <PageHeader
        eyebrow="মার্চেন্ডাইজিং · কস্টিং গেট"
        title="কস্ট শিট"
      />
      <Section title="কোটেশন">
        {rows.length === 0 ? (
          <Empty>কস্ট শিট শুরু করতে একটি ইনকোয়ারি নিশ্চিত করুন।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
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
                  const under = m.pct < q.floorMargin
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
                        <div className="text-xs text-subtle">{q.style}</div>
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
