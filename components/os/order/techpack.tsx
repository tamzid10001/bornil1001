import type { Order, TechPack } from '@/lib/db/schema'
import { bn, day, localDay } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, Section } from '@/components/os/ui'
import { addPackTrims, readPack } from '@/app/os/actions/export'

export function TechPackSection({ order, pack, nameOf, role }: { order: Order; pack: TechPack | undefined; nameOf: (id: number | null) => string; role: string }) {
  const canRead = ['owner', 'merchandiser'].includes(role) && !order.closedAt
  const canTrim = ['owner', 'merchandiser', 'store'].includes(role) && !order.closedAt
  const d = pack?.data
  const found = d ? Array.from(new Set(d.measurements.flatMap((m) => Object.keys(m.sizes)))) : []
  const ordered = Object.keys(order.sizes)
  const sizeCols = [...ordered.filter((s) => found.includes(s)), ...found.filter((s) => !ordered.includes(s))]
  const smv = d?.operations.reduce((s, o) => s + (o.smv ?? 0), 0) ?? 0

  return (
    <Section
      title="টেক প্যাক"
      aside={pack ? <span className="text-sm text-muted">{pack.reader === 'ai' ? 'এআই পড়েছে' : 'প্যাটার্নে পড়া'} · {nameOf(pack.createdBy)} · {day(localDay(pack.createdAt))}</span> : null}
    >
      {d ? (
        <div className="flex flex-col gap-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            {d.fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted">{f.label}</dt>
                <dd className={f.value ? (f.confidence < 0.7 ? 'text-alert' : '') : 'text-muted'} title={f.source ?? undefined}>
                  {f.value ?? 'পাওয়া যায়নি'}
                  {f.value && f.confidence < 0.7 ? <span className="sr-only"> (যাচাই করুন)</span> : null}
                </dd>
              </div>
            ))}
          </dl>

          {d.measurements.length ? (
            <div className="flex flex-col gap-2">
              <span className="label">মাপের তালিকা (সেমি)</span>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-rule text-left text-muted">
                      <th className="py-2 pr-3 font-normal">মাপের স্থান</th>
                      {sizeCols.map((s) => (
                        <th key={s} className="py-2 pr-3 text-right font-normal">
                          {s}
                        </th>
                      ))}
                      <th className="py-2 text-right font-normal">সহনসীমা</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.measurements.map((m, i) => (
                      <tr key={i} className="border-b border-rule">
                        <td className="py-2 pr-3">{m.point}</td>
                        {sizeCols.map((s) => (
                          <td key={s} className="num py-2 pr-3 text-right">
                            {m.sizes[s] ?? '—'}
                          </td>
                        ))}
                        <td className="num py-2 text-right text-muted">{m.tolerance ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="label">ট্রিম</span>
                {pack!.trimsAdded ? <Chip status="booked">বিওএম-এ যোগ হয়েছে</Chip> : null}
              </div>
              {d.trims.length ? (
                <ul className="flex flex-col text-sm">
                  {d.trims.map((t, i) => (
                    <li key={i} className="flex justify-between gap-3 border-b border-rule py-2">
                      <span>{t.item}</span>
                      <span className="num text-muted">{t.qtyPerPc ? `পিসপ্রতি ${bn(t.qtyPerPc)}` : '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">কোনো ট্রিম পাওয়া যায়নি</p>
              )}
              {canTrim && !pack!.trimsAdded && d.trims.some((t) => t.qtyPerPc) ? (
                <ActionForm action={addPackTrims}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="pack_id" value={pack!.id} />
                  <Submit small quiet>
                    ট্রিম বিওএম-এ যোগ করুন
                  </Submit>
                </ActionForm>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <span className="label">অপারেশন ব্রেকডাউন</span>
                {smv ? <span className="num text-sm font-medium">মোট {bn(Math.round(smv * 100) / 100)} এসএমভি</span> : null}
              </div>
              {d.operations.length ? (
                <ol className="flex flex-col text-sm">
                  {d.operations.map((o, i) => (
                    <li key={i} className="flex justify-between gap-3 border-b border-rule py-2">
                      <span>{o.name}</span>
                      <span className="num text-muted">{o.smv ?? '—'}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted">কোনো অপারেশন পাওয়া যায়নি</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {canRead ? (
        <details open={!pack}>
          <summary className="cursor-pointer text-sm font-medium underline-offset-4 hover:underline">{pack ? 'নতুন সংস্করণ পড়ান' : 'ক্রেতার টেক প্যাক পেস্ট করুন'}</summary>
          <ActionForm action={readPack} resetOnSuccess className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="order_id" value={order.id} />
            <textarea
              name="body"
              required
              rows={8}
              minLength={40}
              className="field font-mono text-xs"
              aria-label="টেক প্যাকের লেখা"
              placeholder={'Style: NV-TS-2201\nFabric: Single jersey, 180 GSM, 100% cotton\nSizes: S M L XL\nChest width 1/2   50 52 54 56  tol ±1\nCare label 1 pc\nAttach collar 0.85'}
            />
            <p className="text-xs leading-relaxed text-muted">পিডিএফ থেকে লেখা কপি করে পেস্ট করুন। এআই মাপ, ট্রিম আর অপারেশন আলাদা করবে — কম নিশ্চিত তথ্য লাল দেখাবে।</p>
            <div>
              <Submit small>টেক প্যাক পড়ান</Submit>
            </div>
          </ActionForm>
        </details>
      ) : !pack ? (
        <p className="text-sm text-muted">মার্চেন্ডাইজার টেক প্যাক যোগ করবেন।</p>
      ) : null}
    </Section>
  )
}
