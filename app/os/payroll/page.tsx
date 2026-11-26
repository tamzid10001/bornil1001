import { asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { employees } from '@/lib/db/schema'
import { getActor } from '@/lib/actor'
import { getLang } from '@/lib/i18n'
import { wage, WAGE_GRADES } from '@/lib/domain'
import { bdt, bn } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { PageHeader, Section, Stat } from '@/components/os/ui'
import { addEmployee, updateAttendance } from '../actions/ops'

export const metadata = { title: 'বেতন' }

export default async function PayrollPage() {
  const [lang, actor, staff] = await Promise.all([getLang(), getActor(), db.select().from(employees).orderBy(asc(employees.code))])
  const L = lang === 'bn'
  const canEdit = actor?.role === 'hr' || actor?.role === 'owner'
  const rows = staff.map((e) => ({ e, w: wage(e.grade, e.daysPresent, e.otHours) }))
  const total = rows.reduce((s, r) => s + r.w.net, 0)
  const ot = rows.reduce((s, r) => s + r.w.ot, 0)
  const money = (v: number) => (L ? bn(bdt(v)) : bdt(v))

  return (
    <>
      <PageHeader
        eyebrow={L ? 'এইচআর ও বেতন' : 'hr & payroll'}
        title={L ? 'এই মাসের বেতন' : 'This month’s wages'}
      />
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={money(total)} label={L ? 'মোট প্রদেয়' : 'total payable'} />
        <Stat value={money(ot)} label={L ? 'ওভারটাইম' : 'overtime'} />
        <Stat value={L ? bn(staff.length) : staff.length} label={L ? 'শ্রমিক' : 'workers'} />
        <Stat value={money(WAGE_GRADES[5])} label={L ? 'সর্বনিম্ন মজুরি (গ্রেড ৫)' : 'minimum wage (grade 5)'} />
      </div>

      <Section title={L ? 'বেতন তালিকা' : 'wage sheet'}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>{L ? 'শ্রমিক' : 'worker'}</th>
                <th>{L ? 'গ্রেড' : 'grade'}</th>
                <th>{L ? 'উপস্থিতি · ওটি' : 'days · OT hours'}</th>
                <th className="text-right">{L ? 'অর্জিত' : 'earned'}</th>
                <th className="text-right">{L ? 'বোনাস' : 'bonus'}</th>
                <th className="text-right">{L ? 'ওটি' : 'OT'}</th>
                <th className="text-right">{L ? 'নিট' : 'net'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, w }) => (
                <tr key={e.id}>
                  <td>
                    <span className="font-medium">{e.name}</span>
                    <div className="text-xs text-subtle">
                      {e.code} · {e.section}
                      {e.line ? ` · line ${e.line}` : ''}
                    </div>
                  </td>
                  <td className="num">{L ? bn(e.grade) : e.grade}</td>
                  <td>
                    {canEdit ? (
                      <ActionForm action={updateAttendance} hideOk className="flex items-center gap-1.5">
                        <input type="hidden" name="employee_id" value={e.id} />
                        <input name="days" type="number" min={0} max={31} defaultValue={e.daysPresent} aria-label={`days present for ${e.name}`} className="field num h-8 w-14 px-2 text-sm" />
                        <input name="ot" type="number" min={0} max={104} step="0.5" defaultValue={e.otHours} aria-label={`overtime hours for ${e.name}`} className="field num h-8 w-16 px-2 text-sm" />
                        <Submit small quiet>
                          {L ? 'সংরক্ষণ' : 'save'}
                        </Submit>
                      </ActionForm>
                    ) : (
                      <span className="num">
                        {e.daysPresent} · {e.otHours}
                      </span>
                    )}
                  </td>
                  <td className="num text-right">{money(w.earned)}</td>
                  <td className="num text-right">{w.bonus ? money(w.bonus) : '—'}</td>
                  <td className={`num text-right ${e.otHours > 52 ? 'text-alert' : ''}`}>{money(w.ot)}</td>
                  <td className="num text-right font-medium">{money(w.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-subtle">{L ? 'মাসে ৫২ ঘণ্টার বেশি ওভারটাইম লাল রঙে দেখানো হয়।' : 'Overtime above 52 hours a month is flagged.'}</p>
      </Section>

      {canEdit ? (
        <Section title={L ? 'নতুন শ্রমিক যোগ করুন' : 'add a worker'}>
          <ActionForm action={addEmployee} resetOnSuccess className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="label">{L ? 'নাম' : 'name'}</span>
              <input name="name" required className="field w-48" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">{L ? 'সেকশন' : 'section'}</span>
              <input name="section" required defaultValue="sewing" className="field w-36" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">{L ? 'গ্রেড' : 'grade'}</span>
              <select name="grade" defaultValue="5" className="field w-24">
                {[1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="label">{L ? 'লাইন' : 'line'}</span>
              <input name="line" type="number" min={1} className="field num w-20" />
            </label>
            <Submit>{L ? 'যোগ করুন' : 'add'}</Submit>
          </ActionForm>
        </Section>
      ) : null}
    </>
  )
}
