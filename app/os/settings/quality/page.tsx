import { redirect } from 'next/navigation'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { AQL_VALUES, aqlPlan } from '@/lib/config'
import { bn, n } from '@/lib/format'
import { ListEditor, type Field } from '@/components/os/settings/list-editor'
import { SectionForm } from '@/components/os/settings/section-form'
import { Section } from '@/components/os/ui'

const DEFECT_FIELDS: Field[] = [
  { key: 'code', label: 'কোড', kind: 'text', width: '6rem', identity: 'locked', placeholder: 'D10' },
  { key: 'label', label: 'ত্রুটির নাম', kind: 'text', width: 'minmax(12rem,1fr)' },
]

const LOTS = [150, 500, 1200, 3200, 10000, 35000, 150000]

export default async function QualitySettingsPage() {
  const [actor, config] = await Promise.all([getActor(), getConfig()])
  if (!grantsFor(actor)['settings.manage']) redirect('/os/settings/people')
  const { level, aql } = config.quality

  return (
    <>
      <SectionForm
        section="quality"
        title="চূড়ান্ত পরিদর্শন"
        className="grid gap-4 sm:grid-cols-2 lg:max-w-xl"
      >
        <label className="flex flex-col gap-1.5">
          <span className="label">পরিদর্শন লেভেল</span>
          <select name="level" defaultValue={level} className="field">
            <option value="I">I · কম নমুনা</option>
            <option value="II">II · সাধারণ</option>
            <option value="III">III · কড়া</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">মেজর ত্রুটির একিউএল</span>
          <select name="aql" defaultValue={String(aql)} className="field">
            {AQL_VALUES.map((v) => (
              <option key={v} value={String(v)}>
                {bn(v)}
              </option>
            ))}
          </select>
        </label>
      </SectionForm>

      <Section title={`বর্তমান পরিকল্পনা · লেভেল ${level}, একিউএল ${bn(aql)}`}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="text-right">লটের আকার</th>
                <th>কোড</th>
                <th className="text-right">নমুনা</th>
                <th className="text-right">গ্রহণযোগ্য ≤</th>
                <th className="text-right">প্রত্যাখ্যান ≥</th>
              </tr>
            </thead>
            <tbody>
              {LOTS.map((lot) => {
                const p = aqlPlan(lot, level, aql)
                return (
                  <tr key={lot}>
                    <td className="num text-right">{n(lot)}</td>
                    <td>{p.letter}</td>
                    <td className="num text-right">{n(p.sample)}</td>
                    <td className="num text-right">{n(p.accept)}</td>
                    <td className="num text-right">{n(p.accept + 1)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <SectionForm section="defects" title="ত্রুটির তালিকা">
        <ListEditor key={JSON.stringify(config.defects)} fields={DEFECT_FIELDS} initial={config.defects} blank={{ code: '', label: '' }} addLabel="ত্রুটি যোগ করুন" />
      </SectionForm>
    </>
  )
}
