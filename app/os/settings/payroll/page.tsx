import { redirect } from 'next/navigation'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { wage } from '@/lib/config'
import { bdt, bn } from '@/lib/format'
import { ListEditor, type Field } from '@/components/os/settings/list-editor'
import { NumberField, SectionForm } from '@/components/os/settings/section-form'

const GRADE_FIELDS: Field[] = [
  { key: 'grade', label: 'গ্রেড', kind: 'number', width: '6rem', min: 1, max: 30, step: '1' },
  { key: 'gross', label: 'মাসিক মোট মজুরি (৳)', kind: 'number', width: 'minmax(10rem,14rem)', min: 0, step: '1' },
]

export default async function PayrollSettingsPage() {
  const [actor, config] = await Promise.all([getActor(), getConfig()])
  if (!grantsFor(actor)['settings.manage']) redirect('/os/settings/people')
  const p = config.payroll
  const lowest = [...p.grades].sort((a, b) => a.gross - b.gross)[0]
  const ex = wage(p, lowest.grade, p.workingDays, 40)

  return (
    <SectionForm
      section="payroll"
      title="বেতন কাঠামো"
      lede="গ্রেডভিত্তিক মোট মজুরি আর হিসাবের নিয়ম। মূল বেতন = (মোট মজুরি − নির্ধারিত ভাতা) ÷ ভাজক; ওটির ঘণ্টাপ্রতি হার = মূল বেতন ÷ মাসিক ঘণ্টা × গুণক। সরকারি গেজেট বদলালে এখানে হালনাগাদ করুন।"
      className="flex flex-col gap-6"
    >
      <ListEditor key={JSON.stringify(p.grades)} fields={GRADE_FIELDS} initial={p.grades} blank={{ grade: p.grades.length + 1, gross: lowest.gross }} addLabel="গ্রেড যোগ করুন" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField name="allowances" label="নির্ধারিত ভাতা (চিকিৎসা, যাতায়াত, খাদ্য)" value={p.allowances} min={0} max={1000000} suffix="৳" />
        <NumberField name="basicDivisor" label="মূল বেতনের ভাজক" value={p.basicDivisor} min={1} max={4} step="0.01" />
        <NumberField name="otMultiplier" label="ওটির গুণক" value={p.otMultiplier} min={1} max={4} step="0.1" suffix="গুণ" />
        <NumberField name="otHoursBase" label="মাসিক কর্মঘণ্টা" value={p.otHoursBase} min={50} max={400} suffix="ঘণ্টা" />
        <NumberField name="workingDays" label="মাসিক কর্মদিবস" value={p.workingDays} min={20} max={31} suffix="দিন" />
        <NumberField name="attendanceBonus" label="পূর্ণ হাজিরা বোনাস" value={p.attendanceBonus} min={0} max={1000000} suffix="৳" />
      </div>
      <p className="rounded-xl bg-key px-4 py-3 text-sm leading-relaxed">
        উদাহরণ — গ্রেড {bn(lowest.grade)}, পূর্ণ হাজিরা, ৪০ ঘণ্টা ওটি: মূল বেতন {bdt(ex.basic)} · ওটির হার {bdt(ex.otRate)}/ঘণ্টা · ওটি {bdt(ex.ot)} · বোনাস {bdt(ex.bonus)} · নিট {bdt(ex.net)}
      </p>
    </SectionForm>
  )
}
