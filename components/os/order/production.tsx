import type { Order } from '@/lib/db/schema'
import { aqlPlan, canPass, DEFECT_CODES } from '@/lib/domain'
import { n, pct, stamp } from '@/lib/format'
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
    <Section title="cutting, sewing & quality">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <span className="label">cutting</span>
          {lays.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>lay</th>
                  <th className="text-right">plies</th>
                  <th className="text-right">marker</th>
                  <th className="text-right">pcs</th>
                  <th>bundles</th>
                </tr>
              </thead>
              <tbody>
                {lays.map((l) => {
                  const pcs = l.plies * Object.values(l.ratio).reduce((a, b) => a + b, 0)
                  return (
                    <tr key={l.id}>
                      <td>#{l.layNo}</td>
                      <td className="num text-right">{l.plies}</td>
                      <td className={`num text-right ${l.markerEff < 82 ? 'text-alert' : ''}`}>{pct(l.markerEff)}</td>
                      <td className="num text-right">{n(pcs)}</td>
                      <td className="num">
                        {l.bundleFrom}–{l.bundleTo}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted">no lays yet</p>
          )}
          {!closed && (role === 'cutting' || role === 'owner') ? (
            <ActionForm action={addLay} resetOnSuccess className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <label className="flex w-24 flex-col gap-1.5">
                <span className="label">plies</span>
                <input name="plies" type="number" defaultValue={80} required className="field num" />
              </label>
              <label className="flex w-28 flex-col gap-1.5">
                <span className="label">marker %</span>
                <input name="marker_eff" type="number" step="0.1" defaultValue={84} required className="field num" />
              </label>
              <Submit small>record lay</Submit>
            </ActionForm>
          ) : null}
        </div>

        <div className="flex flex-col gap-3">
          <span className="label">PP meeting</span>
          <GateNote gate="pp" open={!!order.ppSignedAt}>
            {order.ppSignedAt ? `signed by ${nameOf(order.ppSignedBy)} · ${stamp(order.ppSignedAt)}` : 'bulk sewing output is refused until quality signs the PP meeting.'}
          </GateNote>
          {!order.ppSignedAt && !closed ? (
            canPass('pp', role) ? (
              <ActionForm action={signPp} className="flex flex-col gap-3">
                <input type="hidden" name="order_id" value={order.id} />
                <textarea name="notes" rows={2} className="field" placeholder="decisions: shrinkage 3% allowed, collar tension adjusted…" aria-label="pp meeting decisions" />
                <Submit small>sign the PP meeting</Submit>
              </ActionForm>
            ) : (
              <p className="text-sm text-muted">Switch “acting as” to quality or merchandising to sign.</p>
            )
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="label">sewing by line</span>
            <TextLink href="/os/floor">log an hour</TextLink>
          </div>
          {byLine.size ? (
            <ul className="flex flex-col gap-3">
              {[...byLine.entries()].sort(([a], [b]) => a - b).map(([line, v]) => {
                const eff = v.target ? (v.actual / v.target) * 100 : 0
                return (
                  <li key={line} className="flex flex-col gap-1">
                    <span className="flex justify-between text-sm">
                      <span>line {line}</span>
                      <span className="num text-muted">
                        {n(v.actual)} / {n(v.target)} · <span className={eff < 85 ? 'text-alert' : 'text-foreground'}>{pct(eff, 0)}</span>
                        {v.down ? ` · ${v.down} min down` : ''}
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
            <p className="text-sm text-muted">no output yet</p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="label">defects</span>
            <span className="num text-sm text-muted">
              {n(defectTotal)} · {sewn ? pct((defectTotal / sewn) * 100) : '—'} dhu
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {pareto.slice(0, 5).map((d) => (
              <li key={d.code} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 text-sm">
                <span className="truncate">{d.label}</span>
                <span className="h-1.5 rounded-full bg-key" aria-hidden="true">
                  <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(d.count / top) * 100}%` }} />
                </span>
                <span className="num text-right text-muted">{d.count}</span>
              </li>
            ))}
          </ul>
          {!closed ? (
            <ActionForm action={logDefect} resetOnSuccess className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="order_id" value={order.id} />
              <select name="code" required className="field w-40" aria-label="defect">
                {DEFECT_CODES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label} · {d.bn}
                  </option>
                ))}
              </select>
              <input name="line" type="number" min={1} defaultValue={1} className="field num w-16" aria-label="line" />
              <input name="count" type="number" min={1} defaultValue={1} className="field num w-16" aria-label="count" />
              <Submit small quiet>
                log
              </Submit>
            </ActionForm>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="label">final inspection · AQL 2.5, level II</span>
        {lots.map((l) => (
          <p key={l.id} className="flex flex-wrap items-center gap-3 text-sm">
            <Chip status={l.result} />
            <span className="num">
              lot {n(l.lotSize)} · sampled {l.sample} · {l.major} major (accept ≤ {l.acceptMax})
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
              <span className="label">lot size</span>
              <input name="lot_size" type="number" defaultValue={order.quantity} required className="field num" />
            </label>
            <label className="flex w-32 flex-col gap-1.5">
              <span className="label">major found</span>
              <input name="major" type="number" min={0} required className="field num" />
            </label>
            <p className="pb-2 text-sm text-muted">
              sample {plan.sample}, accept ≤ {plan.accept}
            </p>
            <Submit small>decide the lot</Submit>
          </ActionForm>
        ) : null}
      </div>
    </Section>
  )
}
