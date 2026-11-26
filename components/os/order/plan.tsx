import type { Order } from '@/lib/db/schema'
import { backSchedule, DEPT_LABEL, daysBetween, TNA_LABEL, today } from '@/lib/domain'
import { bn, day, n } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Section } from '@/components/os/ui'
import { commitTna, toggleMilestone } from '@/app/os/actions/orders'
import { replanTna } from '@/app/os/actions/export'
import { acronyms } from '@/lib/acronyms'

type Milestone = { id: number; name: string; ownerDept: string; dueDate: string; doneAt: string | null }

export function PlanSection({ order, milestones, role }: { order: Order; milestones: Milestone[]; role: string }) {
  const t = today()
  const overdue = milestones.filter((m) => !m.doneAt && m.dueDate < t).length
  const schedule = backSchedule(order.shipDate, order.quantity, { lines: order.planLines, perLineDay: order.planPerLineDay, fabricLeadDays: order.planFabricLeadDays })
  const canPlan = ['owner', 'planner', 'merchandiser'].includes(role)
  return (
    <Section
      title="ক্রিটিক্যাল পাথ"
      aside={<span className="text-sm text-muted">{order.tnaCommitted ? (overdue ? `${bn(overdue)}টি ধাপের সময় পেরিয়েছে` : 'পরিকল্পনা অনুযায়ী') : 'নিশ্চিত হয়নি'}</span>}
    >
      <p className="text-sm text-muted">
        শিপমেন্ট {day(order.shipDate)} থেকে পিছিয়ে হিসাব · {bn(order.planLines)}টি লাইন × দৈনিক {n(order.planPerLineDay)} পিস = সেলাই {bn(schedule.sewingDays)} দিন · কাপড়ের লিড টাইম{' '}
        {bn(order.planFabricLeadDays)} দিন ·{' '}
        <span className={schedule.slack < 0 ? 'font-medium text-alert' : 'text-ok'}>
          {schedule.slack < 0 ? `শুরু করতে ${bn(-schedule.slack)} দিন দেরি` : `হাতে ${bn(schedule.slack)} দিন সময়`}
        </span>
      </p>
      {!order.tnaCommitted && !order.closedAt ? (
        <div className="flex flex-col gap-4 rounded-xl border border-rule p-4">
          <ActionForm action={replanTna} className="flex flex-col gap-3">
            <input type="hidden" name="order_id" value={order.id} />
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="label">সেলাই লাইন</span>
                <input name="lines" type="number" min={1} max={60} defaultValue={order.planLines} required className="field num" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">লাইনপ্রতি দৈনিক পিস</span>
                <input name="per_line_day" type="number" min={50} max={5000} defaultValue={order.planPerLineDay} required className="field num" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">কাপড়ের লিড টাইম (দিন)</span>
                <input name="fabric_lead_days" type="number" min={3} max={120} defaultValue={order.planFabricLeadDays} required className="field num" />
              </label>
            </div>
            <div>
              <Submit quiet small disabled={!canPlan}>
                শিপমেন্টের তারিখ থেকে পিছিয়ে হিসাব করুন
              </Submit>
            </div>
          </ActionForm>
          <ActionForm action={commitTna} className="flex flex-col gap-3 border-t border-rule pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-relaxed text-muted">নিশ্চিত করলে প্রতিটি বিভাগ নিজ নিজ তারিখের দায়িত্ব নেবে; এরপর আর তারিখ বদলানো যাবে না।</p>
            <input type="hidden" name="order_id" value={order.id} />
            <Submit small disabled={!canPlan}>
              পরিকল্পনা নিশ্চিত করুন
            </Submit>
          </ActionForm>
        </div>
      ) : null}
      <ol className="flex flex-col">
        {milestones.map((m) => {
          const late = !m.doneAt && m.dueDate < t
          const slip = m.doneAt && m.doneAt > m.dueDate ? daysBetween(m.dueDate, m.doneAt) : 0
          return (
            <li key={m.id} className="flex items-center gap-3 border-t border-rule py-2.5 first:border-t-0">
              <ActionForm action={toggleMilestone} hideOk className="contents">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="tna_id" value={m.id} />
                <button
                  type="submit"
                  disabled={!order.tnaCommitted || !!order.closedAt}
                  aria-label={`${TNA_LABEL[m.name] ?? m.name} ${m.doneAt ? 'আবার খুলুন' : 'সম্পন্ন করুন'}`}
                  aria-pressed={!!m.doneAt}
                  className={`size-5 shrink-0 rounded-full border-2 disabled:opacity-40 ${m.doneAt ? 'border-ok bg-ok' : late ? 'border-alert' : 'border-rule'}`}
                />
              </ActionForm>
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className={m.doneAt ? 'text-muted' : late ? 'font-medium text-alert' : 'font-medium'}>{TNA_LABEL[m.name] ?? acronyms(m.name)}</span>
                <span className="text-xs text-subtle">{DEPT_LABEL[m.ownerDept] ?? m.ownerDept}</span>
              </span>
              <span className={`num text-right text-sm ${late ? 'text-alert' : 'text-muted'}`}>
                {m.doneAt ? `সম্পন্ন ${day(m.doneAt)}${slip ? ` · ${bn(slip)} দিন দেরি` : ''}` : `শেষ তারিখ ${day(m.dueDate)}`}
              </span>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
