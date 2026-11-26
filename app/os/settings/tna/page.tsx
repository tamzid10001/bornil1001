import { redirect } from 'next/navigation'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { lines } from '@/lib/db/schema'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { addDays, AUTO_MILESTONES, backSchedule, optionLabel, today } from '@/lib/config'
import { bn, day, n } from '@/lib/format'
import { ListEditor, type Field } from '@/components/os/settings/list-editor'
import { SectionForm } from '@/components/os/settings/section-form'
import { Section } from '@/components/os/ui'

export default async function TnaSettingsPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [actor, config, { category: picked }] = await Promise.all([getActor(), getConfig(), searchParams])
  if (!grantsFor(actor)['settings.manage']) redirect('/os/settings/people')
  const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(lines).where(and(eq(lines.active, true), eq(lines.kind, 'sewing')))

  const fields: Field[] = [
    { key: 'key', label: 'কোড', kind: 'text', width: '0', identity: 'hidden' },
    { key: 'label', label: 'মাইলস্টোন', kind: 'text', width: 'minmax(10rem,1.5fr)' },
    { key: 'dept', label: 'দায়িত্ব', kind: 'select', width: 'minmax(8rem,1fr)', options: config.departments.map((d) => ({ value: d.key, label: d.label })) },
    { key: 'days', label: 'কত দিন আগে', kind: 'number', width: '5rem', min: -120, max: 365, step: '1' },
    {
      key: 'anchor',
      label: 'কোনটির আগে',
      kind: 'select',
      width: 'minmax(9rem,1.2fr)',
      options: [{ value: 'ship', label: 'শিপমেন্টের তারিখ' }],
      rowOptions: { value: 'key', label: 'label' },
    },
    {
      key: 'span',
      label: 'সঙ্গে যোগ হবে',
      kind: 'select',
      width: '8rem',
      options: [
        { value: 'none', label: 'কিছু না' },
        { value: 'sewing', label: 'সেলাইয়ের দিন' },
        { value: 'fabricLead', label: 'কাপড়ের লিড টাইম' },
      ],
    },
    { key: 'categories', label: 'পোশাক', kind: 'checks', width: '7rem', options: config.categories.map((cat) => ({ value: cat.key, label: cat.label })) },
  ]

  const category = config.categories.find((x) => x.key === picked) ?? config.categories[0]
  const plan = { lines: c || 4, perLineDay: config.production.perLineDay, fabricLeadDays: config.production.fabricLeadDays }
  const example = backSchedule(config.tna, addDays(today(), 90), 30000, plan, category.key)

  return (
    <>
      <SectionForm
        section="tna"
        title="ক্রিটিক্যাল পাথের টেমপ্লেট"
        lede="প্রতিটি মাইলস্টোন অন্য একটি মাইলস্টোন বা শিপমেন্টের তারিখের কত দিন আগে হবে তা লিখুন। নতুন অর্ডার খুললে শিপমেন্টের তারিখ থেকে পিছিয়ে সব তারিখ হিসাব হয়। কোনো মাইলস্টোন শুধু নির্দিষ্ট পোশাকের জন্য হলে “পোশাক” থেকে বেছে নিন; না বাছলে সব পোশাকে থাকবে। আগে খোলা অর্ডারের তারিখ বদলায় না।"
      >
        <ListEditor
          key={JSON.stringify(config.tna)}
          fields={fields}
          initial={config.tna}
          blank={{ key: '', label: '', dept: config.departments[0]?.key ?? 'merchandising', days: 5, anchor: 'ship', span: 'none', categories: [] }}
          addLabel="মাইলস্টোন যোগ করুন"
          stackBelow="xl"
        />
      </SectionForm>

      <Section
        title="এই টেমপ্লেটে একটি নমুনা অর্ডার"
        aside={
          <form className="flex items-center gap-2">
            <label htmlFor="cat" className="text-sm text-muted">
              পোশাক
            </label>
            <select id="cat" name="category" defaultValue={category.key} className="field h-9 w-auto text-sm">
              {config.categories.map((x) => (
                <option key={x.key} value={x.key}>
                  {x.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-quiet btn-sm">
              দেখুন
            </button>
          </form>
        }
      >
        <p className="text-sm text-muted">
          {n(30000)} পিস · শিপমেন্ট {day(addDays(today(), 90))} · {bn(plan.lines)}টি সেলাই লাইন × দৈনিক {n(plan.perLineDay)} পিস = সেলাই {bn(example.sewingDays)} দিন · শুরু {day(example.start)}
        </p>
        <ol className="flex flex-col">
          {example.rows.map((m) => (
            <li key={m.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-rule py-2 first:border-t-0">
              <span className="num w-36 shrink-0 text-sm text-muted">{day(m.due)}</span>
              <span className="font-medium">{m.label}</span>
              <span className="text-xs text-subtle">{optionLabel(config.departments, m.dept)}</span>
              {AUTO_MILESTONES[m.key] ? <span className="text-xs text-ok">স্বয়ংক্রিয় · {AUTO_MILESTONES[m.key]}</span> : null}
            </li>
          ))}
        </ol>
      </Section>
    </>
  )
}
