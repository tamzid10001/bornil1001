import { asc, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { machines, tickets } from '@/lib/db/schema'
import { getActor } from '@/lib/actor'
import { stamp } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, PageHeader, Section, Stat } from '@/components/os/ui'
import { closeTicket, openTicket } from '../actions/ops'

export const metadata = { title: 'maintenance' }

export default async function MaintenancePage() {
  const [actor, allMachines, allTickets] = await Promise.all([
    getActor(),
    db.select().from(machines).orderBy(asc(machines.line), asc(machines.code)),
    db.select().from(tickets).orderBy(desc(tickets.openedAt)),
  ])
  const open = allTickets.filter((t) => !t.closedAt)
  const closed = allTickets.filter((t) => t.closedAt)
  const mttr = closed.length ? Math.round(closed.reduce((s, t) => s + (t.downtimeMin ?? 0), 0) / closed.length) : 0
  const canFix = actor?.role === 'mechanic' || actor?.role === 'owner'
  const machineOf = (id: number) => allMachines.find((m) => m.id === id)
  const lines = [...new Set(allMachines.map((m) => m.line))]

  return (
    <>
      <PageHeader
        eyebrow="maintenance"
        title="Machines and breakdowns"
        lede="Anyone on the floor can mark a machine down. The clock runs until maintenance closes the ticket, and the minutes land on the line's efficiency."
      />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={allMachines.filter((m) => m.status === 'down').length} label="machines down now" tone={open.length ? 'alert' : 'ok'} />
        <Stat value={allMachines.length} label="machines on the floor" />
        <Stat value={closed.length} label="breakdowns closed" />
        <Stat value={`${mttr} min`} label="mean time to repair" />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section title="floor map">
          <div className="flex flex-col gap-5">
            {lines.map((l) => (
              <div key={l} className="flex flex-col gap-2">
                <span className="label">line {l}</span>
                <ul className="flex flex-wrap gap-2">
                  {allMachines
                    .filter((m) => m.line === l)
                    .map((m) => (
                      <li
                        key={m.id}
                        className={`flex flex-col rounded-lg border px-3 py-2 text-xs ${m.status === 'down' ? 'border-alert bg-alert-soft text-alert' : 'border-rule'}`}
                      >
                        <span className="font-medium">{m.code}</span>
                        <span className={m.status === 'down' ? '' : 'text-subtle'}>
                          {m.kind}
                          <span className="sr-only"> · {m.status}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex flex-col gap-10">
          <Section title="raise a breakdown">
            <ActionForm action={openTicket} resetOnSuccess className="flex flex-col gap-3">
              <select name="machine_id" required className="field" aria-label="machine">
                {allMachines
                  .filter((m) => m.status !== 'down')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · line {m.line} · {m.kind}
                    </option>
                  ))}
              </select>
              <input name="issue" required placeholder="needle breaking, thread tension…" className="field" aria-label="fault" />
              <Submit>mark down</Submit>
            </ActionForm>
          </Section>

          <Section title={`open tickets · ${open.length}`}>
            {open.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 border-t border-rule pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm">
                  <span className="font-medium">{machineOf(t.machineId)?.code}</span> · {t.issue}
                </p>
                <p className="text-xs text-alert">down since {stamp(t.openedAt)}</p>
                {canFix ? (
                  <ActionForm action={closeTicket} className="flex gap-2">
                    <input type="hidden" name="ticket_id" value={t.id} />
                    <input name="fix" placeholder="what was fixed" className="field h-8 text-sm" aria-label="fix" />
                    <Submit small>fixed</Submit>
                  </ActionForm>
                ) : null}
              </div>
            ))}
            {!canFix && open.length ? <p className="text-xs text-subtle">Switch to maintenance to close tickets.</p> : null}
          </Section>
        </div>
      </div>

      <Section title="history">
        <table className="tbl">
          <thead>
            <tr>
              <th>machine</th>
              <th>fault</th>
              <th>mechanic</th>
              <th>opened</th>
              <th className="text-right">down</th>
            </tr>
          </thead>
          <tbody>
            {closed.slice(0, 12).map((t) => (
              <tr key={t.id}>
                <td>{machineOf(t.machineId)?.code}</td>
                <td>{t.issue}</td>
                <td>{t.mechanic ?? '—'}</td>
                <td className="text-muted">{stamp(t.openedAt)}</td>
                <td className="num text-right">{t.downtimeMin} min</td>
              </tr>
            ))}
          </tbody>
        </table>
        {open.length ? <Chip status="down">{open.length} still open</Chip> : null}
      </Section>
    </>
  )
}
