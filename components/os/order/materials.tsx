import type { Lc, LcAmendment, Order } from '@/lib/db/schema'
import type { Grants } from '@/lib/actor'
import { LcAmendments } from '@/components/os/order/amend'
import { UNITS, unitLabel, type Config } from '@/lib/config'
import { bn, day, n, tk } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, GateNote, Section } from '@/components/os/ui'
import { addBomLine, bookMaterial, issueUd, openBtb, openMasterLc, requestBtb } from '@/app/os/actions/orders'

type Bom = { id: number; material: string; kind: string; qty: number; unit: string; rate: number; supplier: string | null; source: string; status: string; btbId: number | null; bookedBy: number | null }
type Ud = { id: number; number: string; material: string; permittedQty: number; permittedUnit: string }

const UNIT_CHOICES = ['kg', 'lb', 'yd', 'm', 'pcs', 'set', 'dz', 'cone', 'roll']

export async function MaterialsSection({
  order,
  master,
  lcs,
  ud,
  materials,
  nameOf,
  can,
  config,
  amendments,
}: {
  order: Order
  master: Lc | undefined
  amendments: LcAmendment[]
  lcs: Lc[]
  ud: Ud[]
  materials: Bom[]
  nameOf: (id: number | null) => string
  can: Grants
  config: Config
}) {
  const { modules, gates, commercial } = config
  const btbs = lcs.filter((l) => l.kind === 'btb')
  const btbUsed = btbs.reduce((s, l) => s + l.amount, 0)
  const cap = master ? master.amount * (commercial.btbCap / 100) : 0
  const needsBtb = gates.btb && materials.some((m) => m.source === 'import' && m.status === 'pending' && !m.btbId)
  const closed = !!order.closedAt
  const isCommercial = can['commercial.manage']
  const canAddLine = (can['materials.book'] || can['techpack.manage']) && !closed
  const usedFor = (u: Ud) => materials.filter((m) => m.kind === 'fabric' && m.unit === u.permittedUnit).reduce((s, m) => s + m.qty, 0)
  const category = config.categories.find((c) => c.key === order.category)

  return (
    <Section title={modules.commercial ? 'এলসি ও কাঁচামাল' : 'কাঁচামাল'}>
      {modules.commercial || modules.bond ? (
      <div className="grid gap-6 md:grid-cols-2">
        {modules.commercial ? (
        <div className="flex flex-col gap-3 rounded-xl border border-rule p-4">
          <div className="flex items-center justify-between">
            <span className="label">মাস্টার এলসি</span>
            {master ? <Chip status={master.status} /> : null}
          </div>
          {master ? (
            <>
              <p className="font-medium">{master.number}</p>
              <p className="text-sm text-muted">
                {tk(master.amount)} · {master.bank ?? 'ব্যাংক নির্ধারিত হয়নি'} · {master.portLoading} → {master.portDischarge ?? '—'} · সর্বশেষ শিপমেন্ট {day(master.latestShipment)}
              </p>
              {master.status === 'requested' && isCommercial && !closed ? (
                <ActionForm action={openMasterLc} className="flex flex-col gap-3">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="lc_id" value={master.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <input name="bank" placeholder="অ্যাডভাইজিং ব্যাংক" required className="field" />
                    <input name="port_discharge" placeholder="খালাস বন্দর" required className="field" />
                    <input name="latest_shipment" type="date" defaultValue={master.latestShipment ?? ''} required className="field" aria-label="সর্বশেষ শিপমেন্ট" />
                  </div>
                  <Submit small>প্রাপ্ত এলসি লিখুন</Submit>
                </ActionForm>
              ) : null}
              {master.status !== 'requested' ? (
                <LcAmendments orderId={order.id} master={master} amendments={amendments} nameOf={nameOf} canAmend={isCommercial && !closed} />
              ) : null}
            </>
          ) : (
            <p className="text-sm text-muted">এখনো কোনো মাস্টার এলসি আসেনি</p>
          )}
        </div>
        ) : null}

        {modules.bond ? (
        <div className="flex flex-col gap-3 rounded-xl border border-rule p-4">
          <span className="label">ইউটিলাইজেশন ডিক্লারেশন (ইউডি)</span>
          {ud.length ? (
            ud.map((u) => {
              const used = usedFor(u)
              return (
                <p key={u.id} className="text-sm">
                  <span className="font-medium">{u.number}</span> · অনুমোদিত {u.material} {n(u.permittedQty)} {unitLabel(u.permittedUnit)} · বুক করা {n(used)} {unitLabel(u.permittedUnit)}{' '}
                  <span className={used > u.permittedQty ? 'text-alert' : 'text-ok'}>{used > u.permittedQty ? '· ইউডির সীমা ছাড়িয়েছে' : '· সীমার মধ্যে'}</span>
                </p>
              )
            })
          ) : (can['commercial.manage'] || can['bond.manage']) && !closed ? (
            <ActionForm action={issueUd} className="flex flex-col gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <input name="number" placeholder="ইউডি নং" required className="field" aria-label="ইউডি নং" />
                <input name="material" placeholder="সুতা / কাপড়" defaultValue="সুতা" required className="field" aria-label="অনুমোদিত কাঁচামাল" />
                <input name="qty" type="number" step="0.01" placeholder="অনুমোদিত পরিমাণ" required className="field num" aria-label="অনুমোদিত পরিমাণ" />
                <select name="unit" defaultValue={category?.unit ?? 'kg'} className="field" aria-label="একক">
                  {UNIT_CHOICES.map((u) => (
                    <option key={u} value={u}>
                      {UNITS[u]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Submit small>লিখুন</Submit>
              </div>
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">এখনো ইস্যু হয়নি</p>
          )}
        </div>
        ) : null}
      </div>
      ) : null}

      {modules.commercial ? (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">ব্যাক-টু-ব্যাক এলসি</span>
          {master ? (
            <span className={`num text-sm ${btbUsed > cap ? 'text-alert' : 'text-muted'}`}>
              সীমা {tk(cap)} (মাস্টার এলসির {bn(commercial.btbCap)}%) · ব্যবহৃত {tk(btbUsed)}
            </span>
          ) : null}
        </div>
        {btbs.map((b) => (
          <div key={b.id} className="flex flex-wrap items-center gap-3 border-t border-rule pt-3 text-sm">
            <span className="font-medium">{b.number}</span>
            <span className="num text-muted">{tk(b.amount)}</span>
            <span className="text-muted">{bn(b.tenorDays ?? 0)} দিন</span>
            {b.maturity ? <span className="text-muted">মেয়াদপূর্তি {day(b.maturity)}</span> : null}
            <Chip status={b.status} />
            {b.status === 'requested' && !closed ? (
              <ActionForm action={openBtb} className="ml-auto flex flex-wrap items-center gap-2">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="lc_id" value={b.id} />
                <Submit small disabled={!can['gate.btb']}>
                  ব্যাংকে খুলুন
                </Submit>
              </ActionForm>
            ) : null}
          </div>
        ))}
        {needsBtb && !closed ? (
          <ActionForm action={requestBtb} className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input type="hidden" name="order_id" value={order.id} />
            <input name="bank" placeholder="ইস্যুকারী ব্যাংক" className="field" />
            <label className="flex items-center gap-2">
              <span className="text-sm text-muted">মেয়াদ</span>
              <select name="tenor_days" defaultValue="120" className="field">
                <option value="90">৯০ দিন</option>
                <option value="120">১২০ দিন</option>
                <option value="180">১৮০ দিন</option>
              </select>
            </label>
            <Submit small quiet>
              আমদানি পণ্যের জন্য বিটুবি এলসির আবেদন করুন
            </Submit>
          </ActionForm>
        ) : null}
      </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <span className="label">কাঁচামালের তালিকা (বিওএম)</span>
        {gates.btb ? (
          <GateNote gate="btb" open={!materials.some((m) => m.source === 'import' && m.status === 'pending')}>
            বিটুবি এলসি না খোলা পর্যন্ত আমদানি করা কাঁচামাল বুক করা যাবে না। দেশীয় পণ্য সরাসরি বুক করা যায়।
          </GateNote>
        ) : null}
        <div className="overflow-x-auto">
          <table className="tbl min-w-160">
            <thead>
              <tr>
                <th>কাঁচামাল</th>
                <th className="text-right">পরিমাণ</th>
                <th className="text-right">মূল্য</th>
                <th>উৎস</th>
                <th>অবস্থা</th>
                <th>
                  <span className="sr-only">কাজ</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const btb = btbs.find((b) => b.id === m.btbId)
                const blocked = (gates.btb && m.source === 'import' && btb?.status !== 'opened') || !can['materials.book']
                return (
                  <tr key={m.id}>
                    <td>
                      {m.material}
                      <div className="text-xs text-subtle">
                        {m.kind === 'fabric' ? 'কাপড়' : 'ট্রিম'}
                        {m.supplier ? ` · ${m.supplier} · ${nameOf(m.bookedBy)}` : ''}
                      </div>
                    </td>
                    <td className="num text-right">
                      {n(m.qty)} {unitLabel(m.unit)}
                    </td>
                    <td className="num text-right">{tk(m.qty * m.rate)}</td>
                    <td>{m.source === 'import' ? 'আমদানি' : m.source === 'local' ? 'দেশীয়' : m.source}</td>
                    <td>
                      <Chip status={m.status} />
                    </td>
                    <td>
                      {m.status === 'pending' && !closed ? (
                        <ActionForm action={bookMaterial} className="flex min-w-56 flex-wrap gap-2">
                          <input type="hidden" name="order_id" value={order.id} />
                          <input type="hidden" name="bom_id" value={m.id} />
                          <input name="supplier" placeholder="সরবরাহকারী" required aria-label={`${m.material}-এর সরবরাহকারী`} className="field h-8 w-32 text-sm" />
                          <Submit small quiet disabled={blocked}>
                            বুক করুন
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
        {canAddLine ? (
          <details className="rounded-xl border border-rule p-4">
            <summary className="text-sm font-medium">বিওএম-এ কাঁচামাল যোগ করুন</summary>
            <ActionForm action={addBomLine} resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-6">
              <input type="hidden" name="order_id" value={order.id} />
              <input name="material" required placeholder="যেমন ১২ মিমি বোতাম, ড্রস্ট্রিং, ডেনিম ১২ আউন্স" className="field sm:col-span-3" aria-label="কাঁচামাল" />
              <select name="kind" defaultValue="trim" className="field" aria-label="ধরন">
                <option value="fabric">কাপড়</option>
                <option value="trim">ট্রিম ও অ্যাক্সেসরিজ</option>
              </select>
              <select name="source" defaultValue="local" className="field sm:col-span-2" aria-label="উৎস">
                <option value="local">দেশীয়</option>
                <option value="import">আমদানি{gates.btb ? ' (বিটুবি লাগবে)' : ''}</option>
              </select>
              <input name="qty" type="number" step="0.01" min={0.01} required placeholder="পরিমাণ" className="field num sm:col-span-2" aria-label="পরিমাণ" />
              <select name="unit" defaultValue="pcs" className="field" aria-label="একক">
                {UNIT_CHOICES.map((u) => (
                  <option key={u} value={u}>
                    {UNITS[u]}
                  </option>
                ))}
              </select>
              <input name="rate" type="number" step="0.01" min={0} defaultValue={0} placeholder="এককপ্রতি দর" className="field num sm:col-span-2" aria-label="এককপ্রতি দর (টাকা)" />
              <div className="sm:col-span-1">
                <Submit small quiet>
                  যোগ করুন
                </Submit>
              </div>
            </ActionForm>
          </details>
        ) : null}
      </div>
    </Section>
  )
}
