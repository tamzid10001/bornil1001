import type { Lc, Order } from '@/lib/db/schema'
import { canPass } from '@/lib/domain'
import { bn, day, n, tk } from '@/lib/format'
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
    <Section title="ঋণপত্র ও কাঁচামাল">
      <div className="grid gap-6 md:grid-cols-2">
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
            </>
          ) : (
            <p className="text-sm text-muted">নেই</p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-rule p-4">
          <span className="label">ইউটিলাইজেশন ডিক্লারেশন (ইউডি)</span>
          {ud.length ? (
            ud.map((u) => (
              <p key={u.id} className="text-sm">
                <span className="font-medium">{u.number}</span> · অনুমোদিত সুতা {n(u.yarnPermittedKg)} কেজি · বুক করা {n(yarnUsed)} কেজি{' '}
                <span className={yarnUsed > u.yarnPermittedKg ? 'text-alert' : 'text-ok'}>{yarnUsed > u.yarnPermittedKg ? '· ইউডির বেশি' : '· সীমার মধ্যে'}</span>
              </p>
            ))
          ) : isCommercial && !closed ? (
            <ActionForm action={issueUd} className="flex flex-col gap-3 sm:flex-row">
              <input type="hidden" name="order_id" value={order.id} />
              <input name="number" placeholder="বিজিএমইএ ইউডি নং" required className="field" />
              <input name="yarn_kg" type="number" placeholder="সুতা (কেজি)" required className="field num" />
              <Submit small>লিখুন</Submit>
            </ActionForm>
          ) : (
            <p className="text-sm text-muted">এখনো ইস্যু হয়নি</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="label">ব্যাক-টু-ব্যাক এলসি</span>
          {master ? (
            <span className={`num text-sm ${btbUsed > master.amount * 0.75 ? 'text-alert' : 'text-muted'}`}>
              অনুমোদিত {tk(master.amount * 0.75)}-এর মধ্যে {tk(btbUsed)} (৭৫%)
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
                <Submit small disabled={!canPass('btb', role)}>
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
              আমদানি পণ্যের জন্য বিটুবি অনুরোধ করুন
            </Submit>
          </ActionForm>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <span className="label">বিল অব ম্যাটেরিয়ালস</span>
        <GateNote gate="btb" open={!materials.some((m) => m.source === 'import' && m.status === 'pending')}>
          বিটুবি এলসি না খোলা পর্যন্ত আমদানি করা কাঁচামাল বুক করা যাবে না। দেশীয় পণ্য সরাসরি বুক করা যায়।
        </GateNote>
        <div className="overflow-x-auto">
          <table className="tbl">
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
                const blocked = m.source === 'import' && btb?.status !== 'opened'
                return (
                  <tr key={m.id}>
                    <td>
                      {m.material}
                      {m.supplier ? <div className="text-xs text-subtle">{m.supplier} · {nameOf(m.bookedBy)}</div> : null}
                    </td>
                    <td className="num text-right">
                      {n(m.qty)} {m.unit === 'kg' ? 'কেজি' : m.unit === 'pcs' ? 'পিস' : m.unit}
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
      </div>
    </Section>
  )
}
