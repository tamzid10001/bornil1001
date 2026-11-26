import type { Order } from '@/lib/db/schema'
import { aqlPlan, canPass, DEFECT_CODES } from '@/lib/domain'
import { bn, n, pct, stamp } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, GateNote, Section, TextLink } from '@/components/os/ui'
import { addLay, inspectLot, logDefect, signPp } from '@/app/os/actions/orders'

type Lay = { id: number; layNo: number; plies: number; markerEff: number; ratio: Record<string, number>; bundleFrom: number; bundleTo: number }
type Sew = { line: number; target: number; actual: number; downtimeMin: number }
type Defect = { code: string; label: string; count: number; line: number }
type Lot = { id: number; lotSize: number; sample: number; major: number; acceptMax: number; result: string; decidedBy: number | null; createdAt: Date }

export function ProductionSection({
  order,
  lays,
  sewing,
  defects,
  lots,
  nameOf,
  role,
}: {
  order: Order
  lays: Lay[]
  sewing: Sew[]
  defects: Defect[]
  lots: Lot[]
  nameOf: (id: number | null) => string
  role: string
}) {
  const closed = !!order.closedAt
  const byLine = new Map<number, { target: number; actual: number; down: number }>()
  for (const s of sewing) {
    const c = byLine.get(s.line) ?? { target: 0, actual: 0, down: 0 }
    byLine.set(s.line, { target: c.target + s.target, actual: c.actual + s.actual, down: c.down + s.downtimeMin })
  }
  const sewn = sewing.reduce((s, r) => s + r.actual, 0)
  const defectTotal = defects.reduce((s, d) => s + d.count, 0)
  const pareto = DEFECT_CODES.map((d) => ({ ...d, count: defects.filter((x) => x.code === d.code).reduce((s, x) => s + x.count, 0) }))
    .filter((d) => d.count)
    .sort((a, b) => b.count - a.count)
  const top = pareto[0]?.count ?? 1
  const plan = aqlPlan(order.quantity)

  return (
    <Section title="কাটিং, সেলাই ও মান">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="label">কাটিং</span>
          {lays.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>লে</th>
                  <th className="text-right">প্লাই</th>
                  <th className="text-right">মার্কার</th>
                  <th className="text-right">পিস</th>
                  <th>বান্ডেল</th>
                </tr>
              </thead>
              <tbody>
                {lays.map((l) => {
                  const pcs = l.plies * Object.values(l.ratio).reduce((a, b) => a + b, 0)
                  return (
                    <tr key={l.id}>
                      <td>#{bn(l.layNo)}</td>
                      <td className="num text-right">{n(l.plies)}</td>
                      <td className={`num text-right ${l.markerEff < 82 ? 'text-alert' : ''}`}>{pct(l.markerEff)}</td>
                      <td className="num text-right">{n(pcs)}</td>
                      <td className="num">
                        {bn(l.bundleFrom)}–{bn(l.bundleTo)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">এখনো কোনো লে হয়নি</p>
          )}
          {!closed && (role === 'cutting' || role === 'owner') ? (
            <ActionForm action={addLay} resetOnSuccess className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <label className="flex w-24 flex-col gap-1.5">
                <span className="label">প্লাই</span>
                <input name="plies" type="number" defaultValue={80} required className="field num" />
              </label>
              <label className="flex w-28 flex-col gap-1.5">
                <span className="label">মার্কার %</span>
                <input name="marker_eff" type="number" step="0.1" defaultValue={84} required className="field num" />
              </label>
              <Submit small>লে লিখুন</Submit>
            </ActionForm>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <span className="label">পিপি মিটিং</span>
          <GateNote gate="pp" open={!!order.ppSignedAt}>
            {order.ppSignedAt ? `স্বাক্ষর করেছেন ${nameOf(order.ppSignedBy)} · ${stamp(order.ppSignedAt)}` : 'মান নিয়ন্ত্রণ পিপি মিটিং স্বাক্ষর না করা পর্যন্ত বাল্ক সেলাইয়ের আউটপুট নেওয়া হবে না।'}
          </GateNote>
          {!order.ppSignedAt && !closed ? (
            canPass('pp', role) ? (
              <ActionForm action={signPp} className="flex flex-col gap-3">
                <input type="hidden" name="order_id" value={order.id} />
                <textarea name="notes" rows={2} className="field" placeholder="সিদ্ধান্ত: ৩% সংকোচন অনুমোদিত, কলারের টেনশন ঠিক করা হয়েছে…" aria-label="পিপি মিটিংয়ের সিদ্ধান্ত" />
                <Submit small>পিপি মিটিং স্বাক্ষর করুন</Submit>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">স্বাক্ষর করতে “যিনি কাজ করছেন” থেকে মান নিয়ন্ত্রণ বা মার্চেন্ডাইজিং বেছে নিন।</p>
            )
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="label">লাইনভিত্তিক সেলাই</span>
            <TextLink href="/os/floor">এক ঘণ্টার হিসাব লিখুন</TextLink>
          </div>
          {byLine.size ? (
            <ul className="flex flex-col gap-3">
              {[...byLine.entries()].sort(([a], [b]) => a - b).map(([line, v]) => {
                const eff = v.target ? (v.actual / v.target) * 100 : 0
                return (
                  <li key={line} className="flex flex-col gap-1">
                    <span className="flex justify-between text-sm">
                      <span>লাইন {bn(line)}</span>
                      <span className="num text-muted">
                        {n(v.actual)} / {n(v.target)} · <span className={eff < 85 ? 'text-alert' : 'text-foreground'}>{pct(eff, 0)}</span>
                        {v.down ? ` · ${n(v.down)} মিনিট বন্ধ` : ''}
                      </span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-key" aria-hidden="true">
                      <span className={`block h-full ${eff < 85 ? 'bg-alert' : 'bg-ink-fill'}`} style={{ width: `${Math.min(100, eff)}%` }} />
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted">এখনো কোনো আউটপুট নেই</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="label">ত্রুটি</span>
            <span className="num text-sm text-muted">
              {n(defectTotal)} · {sewn ? pct((defectTotal / sewn) * 100) : '—'} ডিএইচইউ
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {pareto.slice(0, 5).map((d) => (
              <li key={d.code} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate">{d.bn}</span>
                <span className="h-1.5 rounded-full bg-key" aria-hidden="true">
                  <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(d.count / top) * 100}%` }} />
                </span>
                <span className="num text-right text-muted">{n(d.count)}</span>
              </li>
            ))}
          </ul>
          {!closed ? (
            <ActionForm action={logDefect} resetOnSuccess className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="order_id" value={order.id} />
              <select name="code" required className="field w-40" aria-label="ত্রুটি">
                {DEFECT_CODES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.bn}
                  </option>
                ))}
              </select>
              <input name="line" type="number" min={1} defaultValue={1} className="field num w-16" aria-label="লাইন" />
              <input name="count" type="number" min={1} defaultValue={1} className="field num w-16" aria-label="সংখ্যা" />
              <Submit small quiet>
                লিখুন
              </Submit>
            </ActionForm>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="label">ফাইনাল ইন্সপেকশন · একিউএল ২.৫, লেভেল II</span>
        {lots.map((l) => (
          <p key={l.id} className="flex flex-wrap items-center gap-3 text-sm">
            <Chip status={l.result} />
            <span className="num">
              লট {n(l.lotSize)} · নমুনা {n(l.sample)} · {n(l.major)}টি মেজর (গ্রহণযোগ্য ≤ {n(l.acceptMax)})
            </span>
            <span className="text-subtle">
              {nameOf(l.decidedBy)} · {stamp(l.createdAt)}
            </span>
          </p>
        ))}
        {!closed && (role === 'qa' || role === 'owner') && !lots.some((l) => l.result === 'accepted') ? (
          <ActionForm action={inspectLot} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="order_id" value={order.id} />
            <label className="flex w-32 flex-col gap-1.5">
              <span className="label">লটের আকার</span>
              <input name="lot_size" type="number" defaultValue={order.quantity} required className="field num" />
            </label>
            <label className="flex w-32 flex-col gap-1.5">
              <span className="label">মেজর ত্রুটি পাওয়া গেছে</span>
              <input name="major" type="number" min={0} required className="field num" />
            </label>
            <p className="pb-2 text-sm text-muted">
              নমুনা {n(plan.sample)}, গ্রহণযোগ্য ≤ {n(plan.accept)}
            </p>
            <Submit small>লটের সিদ্ধান্ত দিন</Submit>
          </ActionForm>
        ) : null}
      </div>
    </Section>
  )
}
