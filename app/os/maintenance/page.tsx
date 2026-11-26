import { asc, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { machines, tickets } from '@/lib/db/schema'
import { getActor } from '@/lib/actor'
import { MACHINE_LABEL } from '@/lib/domain'
import { bn, n, stamp } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, PageHeader, Section, Stat } from '@/components/os/ui'
import { closeTicket, openTicket } from '../actions/ops'

export const metadata = { title: 'রক্ষণাবেক্ষণ' }

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
        eyebrow="রক্ষণাবেক্ষণ"
        title="মেশিন ও ব্রেকডাউন"
      />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={bn(allMachines.filter((m) => m.status === 'down').length)} label="এখন বন্ধ মেশিন" tone={open.length ? 'alert' : 'ok'} />
        <Stat value={bn(allMachines.length)} label="ফ্লোরে মোট মেশিন" />
        <Stat value={bn(closed.length)} label="সমাধান হওয়া ব্রেকডাউন" />
        <Stat value={`${n(mttr)} মিনিট`} label="মেরামতের গড় সময়" />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_22rem]">
        <Section title="ফ্লোর ম্যাপ">
          <div className="flex flex-col gap-5">
            {lines.map((l) => (
              <div key={l} className="flex flex-col gap-2">
                <span className="label">লাইন {bn(l)}</span>
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
                          {MACHINE_LABEL[m.kind] ?? m.kind}
                          <span className="sr-only"> · {m.status === 'down' ? 'বন্ধ' : 'চলছে'}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <div className="flex flex-col gap-10">
          <Section title="ব্রেকডাউন জানান">
            <ActionForm action={openTicket} resetOnSuccess className="flex flex-col gap-3">
              <select name="machine_id" required className="field" aria-label="মেশিন">
                {allMachines
                  .filter((m) => m.status !== 'down')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · লাইন {bn(m.line)} · {MACHINE_LABEL[m.kind] ?? m.kind}
                    </option>
                  ))}
              </select>
              <input name="issue" required placeholder="যেমন সুই ভেঙে যাচ্ছে, সুতার টান ঠিক নেই…" className="field" aria-label="সমস্যা" />
              <Submit>বন্ধ হিসেবে চিহ্নিত করুন</Submit>
            </ActionForm>
          </Section>

          <Section title={`খোলা টিকিট · ${bn(open.length)}`}>
            {open.map((t) => (
              <div key={t.id} className="flex flex-col gap-2 border-t border-rule pt-3 first:border-t-0 first:pt-0">
                <p className="text-sm">
                  <span className="font-medium">{machineOf(t.machineId)?.code}</span> · {t.issue}
                </p>
                <p className="text-xs text-alert">{stamp(t.openedAt)} থেকে বন্ধ</p>
                {canFix ? (
                  <ActionForm action={closeTicket} className="flex gap-2">
                    <input type="hidden" name="ticket_id" value={t.id} />
                    <input name="fix" placeholder="কী ঠিক করা হলো" className="field h-8 text-sm" aria-label="সমাধান" />
                    <Submit small>ঠিক হয়েছে</Submit>
                  </ActionForm>
                ) : null}
              </div>
            ))}
            {!canFix && open.length ? <p className="text-xs text-subtle">টিকিট বন্ধ করতে “বর্তমান ব্যবহারকারী” থেকে মেকানিককে বেছে নিন।</p> : null}
          </Section>
        </div>
      </div>

      <Section title="ইতিহাস">
        <table className="tbl">
          <thead>
            <tr>
              <th>মেশিন</th>
              <th>সমস্যা</th>
              <th>মেকানিক</th>
              <th>শুরু</th>
              <th className="text-right">বন্ধ ছিল</th>
            </tr>
          </thead>
          <tbody>
            {closed.slice(0, 12).map((t) => (
              <tr key={t.id}>
                <td>{machineOf(t.machineId)?.code}</td>
                <td>{t.issue}</td>
                <td>{t.mechanic ?? '—'}</td>
                <td className="text-muted">{stamp(t.openedAt)}</td>
                <td className="num text-right">{n(t.downtimeMin ?? 0)} মিনিট</td>
              </tr>
            ))}
          </tbody>
        </table>
        {open.length ? <Chip status="down">{bn(open.length)}টি এখনো খোলা</Chip> : null}
      </Section>
    </>
  )
}
