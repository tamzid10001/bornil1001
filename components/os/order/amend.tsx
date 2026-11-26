import type { Lc, LcAmendment } from '@/lib/db/schema'
import { bn, day, localDay, tk } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { amendLc } from '@/app/os/actions/export'

const FIELD_LABEL: Record<string, string> = {
  amount: 'এলসির মূল্য',
  latestShipment: 'সর্বশেষ শিপমেন্ট',
  quantity: 'পরিমাণ',
  portDischarge: 'খালাস বন্দর',
  description: 'পণ্যের বিবরণ',
}

function show(field: string, v: string | null) {
  if (v == null || v === '') return '—'
  if (field === 'amount') return tk(Number(v))
  if (field === 'latestShipment') return day(v)
  if (field === 'quantity') return `${bn(Number(v))} পিস`
  return v
}

export function LcAmendments({
  orderId,
  master,
  amendments,
  nameOf,
  canAmend,
}: {
  orderId: number
  master: Lc
  amendments: LcAmendment[]
  nameOf: (id: number | null) => string
  canAmend: boolean
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-rule pt-3">
      <div className="flex items-baseline justify-between">
        <span className="label">সংশোধনী</span>
        <span className="text-xs text-muted">{amendments.length ? `${bn(amendments.length)}টি` : 'কোনো সংশোধনী নেই'}</span>
      </div>
      {amendments.length ? (
        <ol className="flex flex-col gap-2">
          {amendments.map((a) => (
            <li key={a.id} className="text-sm leading-relaxed">
              <span className="font-medium">#{bn(a.no)} {FIELD_LABEL[a.field] ?? a.field}</span>{' '}
              <span className="text-muted line-through">{show(a.field, a.oldValue)}</span> → <span>{show(a.field, a.newValue)}</span>
              <span className="block text-xs text-muted">
                {a.reason} · {nameOf(a.createdBy)} · {day(localDay(a.createdAt))}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
      {canAmend ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-foreground underline-offset-4 hover:underline">ব্যাংক থেকে সংশোধনী এসেছে</summary>
          <ActionForm action={amendLc} resetOnSuccess className="mt-3 flex flex-col gap-3">
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="lc_id" value={master.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="label">কী বদলেছে</span>
                <select name="field" required className="field" defaultValue="">
                  <option value="" disabled>
                    বেছে নিন
                  </option>
                  {Object.entries(FIELD_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">নতুন মান</span>
                <input name="value" required className="field" placeholder="যেমন ২০২৭-০১-১৫ বা ৫২০০০০০" />
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="label">কারণ</span>
              <input name="reason" required className="field" placeholder="যেমন ক্রেতা শিপমেন্ট দুই সপ্তাহ পিছাতে বলেছে" />
            </label>
            <div>
              <Submit small>সংশোধনী লিখুন</Submit>
            </div>
          </ActionForm>
        </details>
      ) : null}
    </div>
  )
}
