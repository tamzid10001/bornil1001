import type { Lc, Order } from '@/lib/db/schema'
import { canPass, today } from '@/lib/domain'
import { blChecks } from '@/lib/queries'
import { stamp } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, GateNote, Section } from '@/components/os/ui'
import { releaseBl, saveBl } from '@/app/os/actions/orders'

type Bl = {
  id: number
  portLoading: string
  portDischarge: string
  quantity: number
  description: string
  onBoard: string
  status: string
  releasedBy: number | null
  releasedAt: Date | null
}

export function ShipSection({
  order,
  master,
  bls,
  nameOf,
  role,
  quantityAccepted,
}: {
  order: Order
  master: Lc | undefined
  bls: Bl[]
  nameOf: (id: number | null) => string
  role: string
  quantityAccepted: boolean
}) {
  const current = bls.find((b) => b.status !== 'released') ?? bls.find((b) => b.status === 'released')
  const checks = current ? blChecks(current, master) : []
  const clean = checks.length > 0 && checks.every((c) => c.ok)
  const released = current?.status === 'released'
  const canEdit = !order.closedAt && !released && (role === 'commercial' || role === 'owner')

  return (
    <Section title="শিপিং ডকুমেন্ট">
      <GateNote gate="b/l" open={released || clean}>
        {released
          ? `ব্যাংকে পাঠিয়েছেন ${nameOf(current!.releasedBy)} · ${stamp(current!.releasedAt)}`
          : 'বি/এল-এর প্রতিটি তথ্য মাস্টার এলসির সঙ্গে মিললে তবেই ডকুমেন্ট কারখানা থেকে যাবে। অমিল হলে ব্যাংক ফি লাগে, টাকাও দেরিতে আসে।'}
      </GateNote>
      {!quantityAccepted && !current ? <p className="text-sm text-muted">গৃহীত ফাইনাল ইন্সপেকশনের অপেক্ষায়।</p> : null}

      {quantityAccepted || current ? (
        <div className="grid gap-8 lg:grid-cols-2">
          {canEdit ? (
            <ActionForm action={saveBl} className="flex flex-col gap-3">
              <input type="hidden" name="order_id" value={order.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="label">লোডিং বন্দর</span>
                  <input name="port_loading" defaultValue={current?.portLoading ?? master?.portLoading ?? ''} required className="field" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">খালাস বন্দর</span>
                  <input name="port_discharge" defaultValue={current?.portDischarge ?? ''} required className="field" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">পরিমাণ (পিস)</span>
                  <input name="quantity" type="number" defaultValue={current?.quantity ?? order.quantity} required className="field num" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">জাহাজে তোলার তারিখ</span>
                  <input name="on_board" type="date" defaultValue={current?.onBoard ?? today()} required className="field" />
                </label>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="label">পণ্যের বিবরণ</span>
                <input name="description" defaultValue={current?.description ?? ''} required className="field" />
              </label>
              <Submit quiet small>
                এলসির সঙ্গে মিলিয়ে দেখুন
              </Submit>
            </ActionForm>
          ) : null}

          {current ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="label">বি/এল বনাম মাস্টার এলসি</span>
                <Chip status={current.status} />
              </div>
              <ul className="flex flex-col">
                {checks.map((c) => (
                  <li key={c.label} className="flex flex-col border-t border-rule py-2 text-sm first:border-t-0">
                    <span className={c.ok ? 'text-ok' : 'font-medium text-alert'}>
                      {c.ok ? 'মিলেছে' : 'অমিল'} · {c.label}
                    </span>
                    {!c.ok ? (
                      <span className="text-muted">
                        এলসিতে আছে {c.expected}, বি/এল-এ আছে {c.found}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {!released && !order.closedAt ? (
                <ActionForm action={releaseBl}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="bl_id" value={current.id} />
                  <Submit small disabled={!canPass('bl', role)}>
                    ডকুমেন্ট ব্যাংকে পাঠান
                  </Submit>
                </ActionForm>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </Section>
  )
}
