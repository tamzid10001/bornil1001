import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig, getFloorPlan } from '@/lib/settings'
import { lineName, optionLabel, wage } from '@/lib/config'
import { bdt, bn } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Empty, ModuleOff, NoAccess, PageHeader, Section, Stat, TextLink } from '@/components/os/ui'
import { addEmployee, updateAttendance } from '../actions/ops'

export const metadata = { title: 'বেতন' }

export default async function PayrollPage() {
  const [actor, config, plan] = await Promise.all([getActor(), getConfig(), getFloorPlan()])
  const can = grantsFor(actor)
  if (!config.modules.payroll) return <ModuleOff title="বেতন" canChange={can['settings.manage']} />
  if (!can['payroll.view'] && !can['payroll.manage']) return <NoAccess title="বেতন" what="বেতন তালিকা" />

  const staff = await db.select().from(employees).orderBy(asc(employees.code))
  const p = config.payroll
  const canEdit = can['payroll.manage']
  const rows = staff.map((e) => ({ e, w: wage(p, e.grade, e.daysPresent, e.otHours) }))
  const total = rows.reduce((s, r) => s + r.w.net, 0)
  const ot = rows.reduce((s, r) => s + r.w.ot, 0)
  const lowest = [...p.grades].sort((a, b) => a.gross - b.gross)[0]
  const grades = [...p.grades].sort((a, b) => a.grade - b.grade)
  const live = plan.lines.filter((l) => l.active)

  return (
    <>
      <PageHeader
        eyebrow="এইচআর ও বেতন"
        title="এই মাসের বেতন"
        actions={can['settings.manage'] ? <TextLink href="/os/settings/payroll">বেতন কাঠামো বদলান</TextLink> : null}
      />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={bdt(total)} label="মোট প্রদেয়" />
        <Stat value={bdt(ot)} label="ওভারটাইম" />
        <Stat value={bn(staff.length)} label="শ্রমিক" />
        <Stat value={bdt(lowest.gross)} label={`সর্বনিম্ন মজুরি (গ্রেড ${bn(lowest.grade)})`} />
      </div>

      <Section title="বেতন তালিকা">
        {rows.length === 0 ? (
          <Empty>এখনো কোনো শ্রমিক যোগ করা হয়নি।</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>শ্রমিক</th>
                  <th>গ্রেড</th>
                  <th>উপস্থিতি · ওটি</th>
                  <th className="text-right">অর্জিত</th>
                  <th className="text-right">বোনাস</th>
                  <th className="text-right">ওটি</th>
                  <th className="text-right">নিট</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ e, w }) => (
                  <tr key={e.id}>
                    <td>
                      <span className="font-medium">{e.name}</span>
                      <div className="text-xs text-subtle">
                        {e.code} · {optionLabel(config.departments, e.section)}
                        {e.line ? ` · ${lineName(plan.lines, e.line)}` : ''}
                      </div>
                    </td>
                    <td className="num">{bn(e.grade)}</td>
                    <td>
                      {canEdit ? (
                        <ActionForm action={updateAttendance} hideOk className="flex items-center gap-1.5">
                          <input type="hidden" name="employee_id" value={e.id} />
                          <input name="days" type="number" min={0} max={31} defaultValue={e.daysPresent} aria-label={`${e.name}-এর উপস্থিতির দিন`} className="field num h-8 w-14 px-2 text-sm" />
                          <input name="ot" type="number" min={0} max={200} step="0.5" defaultValue={e.otHours} aria-label={`${e.name}-এর ওভারটাইম ঘণ্টা`} className="field num h-8 w-16 px-2 text-sm" />
                          <Submit small quiet>
                            সংরক্ষণ
                          </Submit>
                        </ActionForm>
                      ) : (
                        <span className="num">
                          {bn(e.daysPresent)} · {bn(e.otHours)}
                        </span>
                      )}
                    </td>
                    <td className="num text-right">{bdt(w.earned)}</td>
                    <td className="num text-right">{w.bonus ? bdt(w.bonus) : '—'}</td>
                    <td className={`num text-right ${e.otHours > 52 ? 'text-alert' : ''}`}>{bdt(w.ot)}</td>
                    <td className="num text-right font-medium">{bdt(w.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-subtle">
          মাসে {bn(p.workingDays)} কর্মদিবস ধরে হিসাব · ওটি মূল বেতনের {bn(p.otMultiplier)} গুণ · মাসে ৫২ ঘণ্টার বেশি ওভারটাইম লাল রঙে দেখানো হয়।
        </p>
      </Section>

      {canEdit ? (
        <Section title="নতুন শ্রমিক যোগ করুন">
          <ActionForm action={addEmployee} resetOnSuccess className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="label">নাম</span>
              <input name="name" required className="field w-48" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">সেকশন</span>
              <select name="section" required defaultValue="sewing" className="field w-40">
                {config.departments.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">গ্রেড</span>
              <select name="grade" defaultValue={String(grades[grades.length - 1].grade)} className="field w-28">
                {grades.map((g) => (
                  <option key={g.grade} value={g.grade}>
                    {bn(g.grade)} · {bdt(g.gross)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">লাইন</span>
              <select name="line" defaultValue="" className="field w-36">
                <option value="">লাইনের বাইরে</option>
                {live.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <Submit>যোগ করুন</Submit>
          </ActionForm>
        </Section>
      ) : null}
    </>
  )
}
