import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { quotes } from '@/lib/db/schema'
import { quoteMargin } from '@/lib/domain'
import { n, pct, usd } from '@/lib/format'
import { Chip, Empty, PageHeader, Section } from '@/components/os/ui'

export const metadata = { title: 'costing' }

export default async function CostingPage() {
  const rows = await db.select().from(quotes).orderBy(desc(quotes.createdAt))
  return (
    <>
      <PageHeader
        eyebrow="merchandising · costing gate"
        title="Cost sheets"
        lede="A quote whose margin clears the floor releases itself. Anything under the floor waits for the owner, who must write why."
      />
      <Section title="quotes">
        {rows.length === 0 ? (
          <Empty>Confirm an inquiry to start a cost sheet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>quote</th>
                  <th>buyer · style</th>
                  <th className="text-right">qty</th>
                  <th className="text-right">fob</th>
                  <th className="text-right">margin</th>
                  <th>status</th>
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
                        <span className="ml-1 text-xs text-subtle">rev {q.rev}</span>
                      </td>
                      <td>
                        {q.buyer}
                        <div className="text-xs text-subtle">{q.style}</div>
                      </td>
                      <td className="num text-right">{n(q.quantity)}</td>
                      <td className="num text-right">{usd(q.fob)}</td>
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
