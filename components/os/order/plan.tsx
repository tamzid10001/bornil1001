import type { Order } from '@/lib/db/schema'
import { daysBetween, today } from '@/lib/domain'
import { day } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Section } from '@/components/os/ui'
import { commitTna, toggleMilestone } from '@/app/os/actions/orders'
import { acronyms } from '@/lib/acronyms'

type Milestone = { id: number; name: string; ownerDept: string; dueDate: string; doneAt: string | null }

export function PlanSection({ order, milestones, role }: { order: Order; milestones: Milestone[]; role: string }) {
  const t = today()
  const overdue = milestones.filter((m) => !m.doneAt && m.dueDate < t).length
  return (
    <Section
      title="critical path"
      aside={<span className="text-sm text-muted">{order.tnaCommitted ? (overdue ? `${overdue} overdue` : 'on plan') : 'not committed'}</span>}
    >
      {!order.tnaCommitted && !order.closedAt ? (
        <ActionForm action={commitTna} className="flex flex-col gap-3 rounded-xl border border-rule p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-muted">Back-planned from the ship date. Commit it and each department owns its dates.</p>
          <input type="hidden" name="order_id" value={order.id} />
          <Submit small disabled={!['owner', 'planner', 'merchandiser'].includes(role)}>
            commit the plan
          </Submit>
        </ActionForm>
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
                  aria-label={`${m.doneAt ? 'reopen' : 'close'} ${m.name}`}
                  aria-pressed={!!m.doneAt}
                  className={`size-5 shrink-0 rounded-full border-2 disabled:opacity-40 ${m.doneAt ? 'border-ok bg-ok' : late ? 'border-alert' : 'border-rule'}`}
                />
              </ActionForm>
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className={m.doneAt ? 'text-muted' : late ? 'font-medium text-alert' : 'font-medium'}>{acronyms(m.name)}</span>
                <span className="text-xs text-subtle">{m.ownerDept}</span>
              </span>
              <span className={`num text-right text-sm ${late ? 'text-alert' : 'text-muted'}`}>
                {m.doneAt ? `done ${day(m.doneAt)}${slip ? ` · ${slip}d late` : ''}` : `due ${day(m.dueDate)}`}
              </span>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}
