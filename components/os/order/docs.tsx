import type { Carton, Invoice, Lc, Order } from '@/lib/db/schema'
import type { Grants } from '@/lib/actor'
import { invoiceChecks, packingTotals } from '@/lib/export-checks'
import { today } from '@/lib/domain'
import { bn, day, kg, n, tk } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, Empty, Section, TextLink } from '@/components/os/ui'
import { addCartons, issueInvoice, removeCartons, saveInvoice } from '@/app/os/actions/export'

export function ExportDocsSection({
  order,
  master,
  rows,
  invoice,
  blQty,
  can,
}: {
  order: Order
  master: Lc | undefined
  rows: Carton[]
  invoice: Invoice | undefined
  blQty: number | null
  can: Grants
}) {
  const t = packingTotals(rows)
  const closed = !!order.closedAt
  const locked = invoice?.status === 'issued'
  const canPack = can['packing.manage'] && !closed && !locked
  const canInvoice = can['commercial.manage'] && !closed
  const sizes = Object.keys(order.sizes)
  const checks = invoice ? invoiceChecks(invoice, master, t.pcs, blQty) : []

  return (
    <Section title="রপ্তানির কাগজপত্র">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">প্যাকিং লিস্ট</span>
          {rows.length ? <TextLink href={`/docs/${order.id}/packing`}>প্রিন্ট করুন</TextLink> : null}
        </div>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-rule text-left text-muted">
                  <th className="py-2 pr-3 font-normal">কার্টন নং</th>
                  <th className="py-2 pr-3 font-normal">সাইজ</th>
                  <th className="py-2 pr-3 text-right font-normal">কার্টন</th>
                  <th className="py-2 pr-3 text-right font-normal">পিস/কার্টন</th>
                  <th className="py-2 pr-3 text-right font-normal">মোট পিস</th>
                  <th className="py-2 pr-3 text-right font-normal">নিট/গ্রস কেজি</th>
                  <th className="py-2 text-right font-normal">
                    <span className="sr-only">কাজ</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const count = r.cartonTo - r.cartonFrom + 1
                  return (
                    <tr key={r.id} className="border-b border-rule">
                      <td className="num py-2 pr-3">
                        {bn(r.cartonFrom)}–{bn(r.cartonTo)}
                      </td>
                      <td className="py-2 pr-3">{r.size}</td>
                      <td className="num py-2 pr-3 text-right">{bn(count)}</td>
                      <td className="num py-2 pr-3 text-right">{bn(r.pcsPerCarton)}</td>
                      <td className="num py-2 pr-3 text-right">{n(count * r.pcsPerCarton)}</td>
                      <td className="num py-2 pr-3 text-right text-muted">
                        {kg(r.netKg)} / {kg(r.grossKg)}
                      </td>
                      <td className="py-2 text-right">
                        {canPack ? (
                          <ActionForm action={removeCartons} hideOk>
                            <input type="hidden" name="order_id" value={order.id} />
                            <input type="hidden" name="carton_id" value={r.id} />
                            <Submit small quiet>
                              বাদ দিন
                            </Submit>
                          </ActionForm>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-medium">
                  <td className="py-2 pr-3" colSpan={2}>
                    মোট
                  </td>
                  <td className="num py-2 pr-3 text-right">{bn(t.cartons)}</td>
                  <td />
                  <td className="num py-2 pr-3 text-right">{n(t.pcs)}</td>
                  <td className="num py-2 pr-3 text-right">
                    {n(Math.round(t.net))} / {n(Math.round(t.gross))}
                  </td>
                  <td className="num py-2 text-right text-muted">{bn(Math.round(t.cbm * 100) / 100)} সিবিএম</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty>এখনো কোনো কার্টন প্যাক হয়নি।</Empty>
        )}

        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {sizes.map((s) => {
            const packed = t.bySize[s] ?? 0
            const ordered = order.sizes[s]
            return (
              <li key={s} className={packed && packed < ordered * 0.97 ? 'text-alert' : packed >= ordered ? 'text-ok' : 'text-muted'}>
                {s}: {n(packed)} / {n(ordered)}
              </li>
            )
          })}
        </ul>

        {canPack ? (
          <ActionForm action={addCartons} resetOnSuccess className="flex flex-col gap-3 rounded-xl border border-rule p-4">
            <input type="hidden" name="order_id" value={order.id} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input name="from" type="number" min={1} required className="field num" placeholder="শুরু নং" aria-label="শুরুর কার্টন নং" />
              <input name="to" type="number" min={1} required className="field num" placeholder="শেষ নং" aria-label="শেষ কার্টন নং" />
              <select name="size" required className="field" aria-label="সাইজ" defaultValue="">
                <option value="" disabled>
                  সাইজ
                </option>
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input name="pcs" type="number" min={1} required className="field num" placeholder="পিস/কার্টন" aria-label="কার্টনপ্রতি পিস" />
              <input name="net" type="number" step="0.01" min={0.1} required className="field num" placeholder="নিট কেজি" aria-label="কার্টনপ্রতি নিট ওজন" />
              <input name="gross" type="number" step="0.01" min={0.1} required className="field num" placeholder="গ্রস কেজি" aria-label="কার্টনপ্রতি গ্রস ওজন" />
              <input name="cbm" type="number" step="0.001" min={0.001} required className="field num" placeholder="সিবিএম" aria-label="কার্টনপ্রতি সিবিএম" defaultValue="0.065" />
              <Submit small>কার্টন যোগ করুন</Submit>
            </div>
          </ActionForm>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-rule pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="label">কমার্শিয়াল ইনভয়েস</span>
          <div className="flex items-center gap-3">
            {invoice ? <TextLink href={`/docs/${order.id}/invoice`}>প্রিন্ট করুন</TextLink> : null}
            {invoice ? <Chip status={invoice.status} /> : null}
          </div>
        </div>
        {invoice ? (
          <>
            <p className="text-sm">
              <span className="font-medium">{invoice.number}</span> · {day(invoice.issuedOn)} · {n(invoice.quantity)} পিস × {tk(invoice.unitPrice)} ={' '}
              <span className="num font-medium">{tk(invoice.amount)}</span>
              {invoice.exp ? <span className="text-muted"> · ইএক্সপি {invoice.exp}</span> : null}
            </p>
            <ul className="flex flex-col gap-1.5 text-sm">
              {checks.map((c) => (
                <li key={c.label} className="flex flex-wrap items-baseline gap-2">
                  <span className={c.ok ? 'text-ok' : 'text-alert'} aria-hidden>
                    {c.ok ? '✓' : '✕'}
                  </span>
                  <span>{c.label}</span>
                  {!c.ok ? <span className="text-xs text-muted">প্রত্যাশিত {c.expected}, পাওয়া গেছে {c.found}</span> : <span className="sr-only">মিলেছে</span>}
                </li>
              ))}
            </ul>
            {canInvoice && !locked && checks.every((c) => c.ok) ? (
              <ActionForm action={issueInvoice}>
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="invoice_id" value={invoice.id} />
                <Submit small>ইনভয়েস ইস্যু করুন</Submit>
              </ActionForm>
            ) : null}
          </>
        ) : null}
        {canInvoice && !locked ? (
          rows.length ? (
            <ActionForm action={saveInvoice} className="flex flex-col gap-3 rounded-xl border border-rule p-4">
              <input type="hidden" name="order_id" value={order.id} />
              <p className="text-sm text-muted">পরিমাণ {n(t.pcs)} পিস</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="label">পিসপ্রতি দর (৳)</span>
                  <input name="unit_price" type="number" step="0.01" min={0.01} required className="field num" defaultValue={Math.round((invoice?.unitPrice ?? order.fob) * 100) / 100} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">তারিখ</span>
                  <input name="issued_on" type="date" required className="field" defaultValue={invoice?.issuedOn ?? today()} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">ইএক্সপি নং (ঐচ্ছিক)</span>
                  <input name="exp" className="field" defaultValue={invoice?.exp ?? ''} />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="label">পণ্যের বিবরণ</span>
                <input name="description" required className="field" defaultValue={invoice?.description ?? master?.description ?? ''} />
              </label>
              <div>
                <Submit small quiet={!!invoice}>
                  {invoice ? 'খসড়া হালনাগাদ করুন' : 'ইনভয়েসের খসড়া তৈরি করুন'}
                </Submit>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">আগে প্যাকিং লিস্ট তৈরি করুন।</p>
          )
        ) : null}
      </div>
    </Section>
  )
}
