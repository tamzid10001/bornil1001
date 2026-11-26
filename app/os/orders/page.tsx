import Link from 'next/link'
import { db } from '@/lib/db'
import { sewing } from '@/lib/db/schema'
import { listOrders, projection } from '@/lib/queries'
import { day, n, tkK } from '@/lib/format'
import { Chip, Empty, PageHeader, Section, StageRail } from '@/components/os/ui'

export const metadata = { title: 'orders' }

export default async function OrdersPage() {
  const [rows, allSewing] = await Promise.all([listOrders(), db.select().from(sewing)])
  return (
    <>
      <PageHeader
        eyebrow="one record per order"
        title="Orders"
      />
      <Section title={`${rows.length} orders`}>
        {rows.length === 0 ? (
          <Empty>Win a quote to open an order.</Empty>
        ) : (
          <ul className="flex flex-col">
            {rows.map((o) => {
              const p = projection(o, allSewing.filter((s) => s.orderId === o.id))
              return (
                <li key={o.id} className="border-t border-rule first:border-t-0">
                  <Link href={`/os/orders/${o.id}`} className="group grid gap-3 py-5 md:grid-cols-[12rem_1fr_16rem] md:items-center">
                    <span className="flex flex-col">
                      <span className="font-heading text-lg font-semibold group-hover:text-ink">{o.code}</span>
                      <span className="text-sm text-muted">{o.buyer}</span>
                    </span>
                    <span className="flex flex-col gap-2">
                      <span className="text-sm">
                        {o.style} · {n(o.quantity)} pcs · {tkK(o.quantity * o.fob)}
                      </span>
                      <StageRail stage={o.stage} />
                    </span>
                    <span className="flex items-center gap-2 text-sm text-muted md:justify-end">
                      ships {day(o.shipDate)}
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
