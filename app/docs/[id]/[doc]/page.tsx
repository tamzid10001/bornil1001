import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cartons, invoices, lcs, orders } from '@/lib/db/schema'
import { packingTotals } from '@/lib/export-checks'
import { bn, day, kg, n, tk } from '@/lib/format'
import { today } from '@/lib/domain'
import { BornilLogo } from '@/components/os/logo'
import { PrintButton } from './print-button'

export const metadata: Metadata = { title: 'রপ্তানি ডকুমেন্ট', robots: { index: false } }

export default async function DocPage({ params }: { params: Promise<{ id: string; doc: string }> }) {
  const { id, doc } = await params
  if (doc !== 'packing' && doc !== 'invoice') notFound()
  const [o] = await db.select().from(orders).where(eq(orders.id, Number(id)))
  if (!o) notFound()
  const [rows, [inv], [master]] = await Promise.all([
    db.select().from(cartons).where(eq(cartons.orderId, o.id)).orderBy(asc(cartons.cartonFrom)),
    db.select().from(invoices).where(eq(invoices.orderId, o.id)).orderBy(desc(invoices.id)).limit(1),
    db.select().from(lcs).where(and(eq(lcs.orderId, o.id), eq(lcs.kind, 'master'))),
  ])
  if (doc === 'invoice' && !inv) notFound()
  const t = packingTotals(rows)

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 bg-background px-6 py-10 font-sans text-foreground print:px-0 print:py-0">
      <header className="flex items-start justify-between gap-6 border-b border-foreground pb-6">
        <div className="flex flex-col gap-2">
          <BornilLogo className="h-7 w-auto self-start" />
          <p className="text-xs leading-relaxed text-muted">Bornil Technologies Limited · Banani, Dhaka, Bangladesh</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <h1 className="text-xl font-semibold">{doc === 'packing' ? 'প্যাকিং লিস্ট' : 'কমার্শিয়াল ইনভয়েস'}</h1>
          {inv && doc === 'invoice' ? <p className="num text-sm">{inv.number}</p> : null}
          <p className="text-sm text-muted">{day(doc === 'invoice' && inv ? inv.issuedOn : today())}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
        <Row label="ক্রেতা" value={o.buyer} />
        <Row label="অর্ডার / স্টাইল" value={`${o.code} · ${o.style}`} />
        <Row label="এলসি নং" value={master ? `${master.number}${master.bank ? ` · ${master.bank}` : ''}` : '—'} />
        <Row label="বন্দর" value={master ? `${master.portLoading ?? '—'} → ${master.portDischarge ?? '—'}` : '—'} />
        {inv?.exp ? <Row label="ইএক্সপি নং" value={inv.exp} /> : null}
        <Row label="পণ্যের বিবরণ" value={inv?.description ?? master?.description ?? o.style} />
      </dl>

      {doc === 'packing' ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-foreground text-left">
              <th className="py-2 pr-2 font-medium">কার্টন নং</th>
              <th className="py-2 pr-2 font-medium">সাইজ</th>
              <th className="py-2 pr-2 text-right font-medium">কার্টন</th>
              <th className="py-2 pr-2 text-right font-medium">পিস/কার্টন</th>
              <th className="py-2 pr-2 text-right font-medium">মোট পিস</th>
              <th className="py-2 pr-2 text-right font-medium">নেট কেজি</th>
              <th className="py-2 text-right font-medium">গ্রস কেজি</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = r.cartonTo - r.cartonFrom + 1
              return (
                <tr key={r.id} className="border-b border-rule">
                  <td className="num py-1.5 pr-2">
                    {bn(r.cartonFrom)}–{bn(r.cartonTo)}
                  </td>
                  <td className="py-1.5 pr-2">{r.size}</td>
                  <td className="num py-1.5 pr-2 text-right">{bn(c)}</td>
                  <td className="num py-1.5 pr-2 text-right">{bn(r.pcsPerCarton)}</td>
                  <td className="num py-1.5 pr-2 text-right">{n(c * r.pcsPerCarton)}</td>
                  <td className="num py-1.5 pr-2 text-right">{kg(c * r.netKg)}</td>
                  <td className="num py-1.5 text-right">{kg(c * r.grossKg)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground font-semibold">
              <td className="py-2 pr-2" colSpan={2}>
                মোট
              </td>
              <td className="num py-2 pr-2 text-right">{bn(t.cartons)}</td>
              <td />
              <td className="num py-2 pr-2 text-right">{n(t.pcs)}</td>
              <td className="num py-2 pr-2 text-right">{n(Math.round(t.net))}</td>
              <td className="num py-2 text-right">{n(Math.round(t.gross))}</td>
            </tr>
          </tfoot>
        </table>
      ) : inv ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-foreground text-left">
              <th className="py-2 pr-2 font-medium">বিবরণ</th>
              <th className="py-2 pr-2 text-right font-medium">পরিমাণ</th>
              <th className="py-2 pr-2 text-right font-medium">দর</th>
              <th className="py-2 text-right font-medium">মূল্য</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-rule">
              <td className="py-2 pr-2">
                {inv.description}
                <span className="block text-xs text-muted">
                  {Object.entries(t.bySize)
                    .map(([s, q]) => `${s} ${n(q)}`)
                    .join(' · ')}
                </span>
              </td>
              <td className="num py-2 pr-2 text-right">{n(inv.quantity)} পিস</td>
              <td className="num py-2 pr-2 text-right">{tk(inv.unitPrice)}</td>
              <td className="num py-2 text-right">{tk(inv.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-t border-foreground font-semibold">
              <td className="py-2 pr-2" colSpan={3}>
                সর্বমোট · {bn(t.cartons)} কার্টন · নেট {n(Math.round(t.net))} কেজি · গ্রস {n(Math.round(t.gross))} কেজি
              </td>
              <td className="num py-2 text-right">{tk(inv.amount)}</td>
            </tr>
          </tfoot>
        </table>
      ) : null}

      <footer className="mt-12 flex items-end justify-between gap-6 text-sm">
        <p className="text-muted">{inv?.status === 'issued' || doc === 'packing' ? '' : 'খসড়া — ইস্যু করা হয়নি'}</p>
        <div className="flex flex-col items-center gap-1">
          <span className="h-px w-48 bg-foreground" aria-hidden />
          <span className="text-xs text-muted">অনুমোদিত স্বাক্ষর</span>
        </div>
      </footer>
      <PrintButton />
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
