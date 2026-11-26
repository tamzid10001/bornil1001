import type { Lc, Order } from '@/lib/db/schema'
import { canPass } from '@/lib/domain'
import { day, n, tk } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, GateNote, Section } from '@/components/os/ui'
import { bookMaterial, issueUd, openBtb, openMasterLc, requestBtb } from '@/app/os/actions/orders'

type Bom = { id: number; material: string; qty: number; unit: string; rate: number; supplier: string | null; source: string; status: string; btbId: number | null; bookedBy: number | null }
type Ud = { id: number; number: string; yarnPermittedKg: number }

export async function MaterialsSection({
  order,
  master,
  lcs,
  ud,
  materials,
  nameOf,
  role,
}: {
  order: Order
  master: Lc | undefined
  lcs: Lc[]
  ud: Ud[]
  materials: Bom[]
  nameOf: (id: number | null) => string
  role: string
}) {
  const btbs = lcs.filter((l) => l.kind === 'btb')
  const btbUsed = btbs.reduce((s, l) => s + l.amount, 0)
  const needsBtb = materials.some((m) => m.source === 'import' && m.status === 'pending' && !m.btbId)
  const closed = !!order.closedAt
  const isCommercial = role === 'owner' || role === 'commercial'
  const yarnUsed = materials.filter((m) => m.unit === 'kg').reduce((s, m) => s + m.qty, 0)

  return (
    <Section title="letters of credit & materials">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border border-rule p-4">
          <div className="flex items-center justify-between">
            <span className="label">master LC</span>
            {master ? <Chip status={master.status} /> : null}
          </div>
          {master ? (
            <>
              <p className="font-medium">{master.number}</p>
              <p className="text-sm text-muted">
                {tk(master.amount)} · {master.bank ?? 'bank tbc'} · {master.portLoading} → {master.portDischarge ?? '—'} · latest shipment {day(master.latestShipment)}
              </p>
              {master.status === 'requested' && isCommercial && !closed ? (
                <ActionForm action={openMasterLc} className="flex flex-col gap-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="lc_id" value={master.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input name="bank" placeholder="advising bank" required className="field" />
                    <input name="port_discharge" placeholder="port of discharge" required className="field" />
                    <input name="latest_shipment" type="date" defaultValue={master.latestShipment ?? ''} required className="field" aria-label="latest shipment" />
                  </div>
                  <Submit small>record received LC</Submit>
                </ActionForm>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">none</p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-rule p-4">
          <span className="label">utilization declaration (UD)</span>
          {ud.length ? (
            ud.map((u) => (
              <p key={u.id} className="text-sm">
                <span className="font-medium">{u.number}</span> · yarn permitted {n(u.yarnPermittedKg)} kg · booked {n(yarnUsed)} kg{' '}
                <span className={yarnUsed > u.yarnPermittedKg ? 'text-alert' : 'text-ok'}>{yarnUsed > u.yarnPermittedKg ? '· over the UD' : '· within'}</span>
              </p>
            ))
          ) : isCommercial && !closed ? (
            <ActionForm action={issueUd} className="flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="order_id" value={order.id} />
              <input name="number" placeholder="BGMEA UD no." required className="field" />
              <input name="yarn_kg" type="number" placeholder="yarn kg" required className="field num" />
              <Submit small>record</Submit>
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">not issued yet</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">back-to-back LCs</span>
          {master ? (
            <span className={`num text-sm ${btbUsed > master.amount * 0.75 ? 'text-alert' : 'text-muted'}`}>
              {tk(btbUsed)} of {tk(master.amount * 0.75)} allowed (75%)
            </span>
          ) : null}
        </div>
        {btbs.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 border-t border-rule pt-3 text-sm">
            <span className="font-medium">{b.number}</span>
            <span className="num text-muted">{tk(b.amount)}</span>
            <span className="text-muted">{b.tenorDays} days</span>
            {b.maturity ? <span className="text-muted">matures {day(b.maturity)}</span> : null}
            <Chip status={b.status} />
            {b.status === 'requested' && !closed ? (
              <ActionForm action={openBtb} className="ml-auto flex flex-wrap items-center gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="lc_id" value={b.id} />
                <Submit small disabled={!canPass('btb', role)}>
                  open at bank
                </Submit>
              </ActionForm>
            ) : null}
          </div>
        ))}
        {needsBtb && !closed ? (
          <ActionForm action={requestBtb} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input type="hidden" name="order_id" value={order.id} />
            <input name="bank" placeholder="issuing bank" className="field" />
            <label className="flex items-center gap-2">
              <span className="text-sm text-muted">tenor</span>
              <select name="tenor_days" defaultValue="120" className="field">
                <option value="90">90 days</option>
                <option value="120">120 days</option>
                <option value="180">180 days</option>
              </select>
            </label>
            <Submit small quiet>
              request btb for imported items
            </Submit>
          </ActionForm>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <span className="label">bill of materials</span>
        <GateNote gate="btb" open={!materials.some((m) => m.source === 'import' && m.status === 'pending')}>
          imported materials cannot be booked until their btb lc is opened. local items book freely.
        </GateNote>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>material</th>
                <th className="text-right">qty</th>
                <th className="text-right">value</th>
                <th>source</th>
                <th>status</th>
                <th>
                  <span className="sr-only">action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const btb = btbs.find((b) => b.id === m.btbId)
                const blocked = m.source === 'import' && btb?.status !== 'opened'
                return (
                  <tr key={m.id}>
                    <td>
                      {m.material}
                      {m.supplier ? <div className="text-xs text-subtle">{m.supplier} · {nameOf(m.bookedBy)}</div> : null}
                    </td>
                    <td className="num text-right">
                      {n(m.qty)} {m.unit}
                    </td>
                    <td className="num text-right">{tk(m.qty * m.rate)}</td>
                    <td>{m.source}</td>
                    <td>
                      <Chip status={m.status} />
                    </td>
                    <td>
                      {m.status === 'pending' && !closed ? (
                        <ActionForm action={bookMaterial} className="flex min-w-56 flex-wrap gap-2">
                          <input type="hidden" name="order_id" value={order.id} />
                          <input type="hidden" name="bom_id" value={m.id} />
                          <input name="supplier" placeholder="supplier" required aria-label={`supplier for ${m.material}`} className="field h-8 w-32 text-sm" />
                          <Submit small quiet disabled={blocked}>
                            book
                          </Submit>
                        </ActionForm>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  )
}
