import { redirect } from 'next/navigation'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { STAGES, UNITS } from '@/lib/config'
import { ListEditor, type Field } from '@/components/os/settings/list-editor'
import { NumberField, SectionForm } from '@/components/os/settings/section-form'

const UNIT_OPTIONS = ['kg', 'lb', 'yd', 'm', 'pcs'].map((u) => ({ value: u, label: UNITS[u] }))

const CATEGORY_FIELDS: Field[] = [
  { key: 'key', label: 'কোড', kind: 'text', width: '7rem', identity: 'locked', placeholder: 'polo' },
  { key: 'label', label: 'নাম', kind: 'text', width: 'minmax(10rem,1.6fr)' },
  { key: 'unit', label: 'কাপড়ের একক', kind: 'select', width: '7rem', options: UNIT_OPTIONS },
  { key: 'sizes', label: 'সাইজ (কমা দিয়ে)', kind: 'csv', width: 'minmax(9rem,1.2fr)', placeholder: 'S, M, L, XL' },
  { key: 'ratio', label: 'অনুপাত', kind: 'csv-number', width: '8rem', placeholder: '1, 3, 3, 2' },
]

const OPTION_FIELDS: Field[] = [
  { key: 'key', label: 'কোড', kind: 'text', width: '9rem', identity: 'locked' },
  { key: 'label', label: 'নাম', kind: 'text', width: 'minmax(12rem,1fr)' },
]

export default async function ProductionSettingsPage() {
  const [actor, config] = await Promise.all([getActor(), getConfig()])
  if (!grantsFor(actor)['settings.manage']) redirect('/os/settings/people')
  const p = config.production

  return (
    <>
      <SectionForm
        section="categories"
        title="পোশাকের ধরন"
        lede="প্রতিটি ধরনের নিজস্ব কাপড়ের একক, সাইজ ও সাইজের অনুপাত থাকে। নতুন অর্ডারে পরিমাণ এই অনুপাতে সাইজে ভাগ হয়, কস্ট শিটে কাপড় এই এককে হিসাব হয়, আর ক্রিটিক্যাল পাথে ধরন-নির্দিষ্ট মাইলস্টোন যোগ হয়।"
      >
        <ListEditor key={JSON.stringify(config.categories)} fields={CATEGORY_FIELDS} initial={config.categories} blank={{ key: '', label: '', unit: 'kg', sizes: ['S', 'M', 'L', 'XL'], ratio: [1, 2, 2, 1] }} addLabel="ধরন যোগ করুন" stackBelow="xl" />
      </SectionForm>

      <SectionForm section="production" title="উৎপাদনের হিসাব" lede="নতুন অর্ডারের ক্রিটিক্যাল পাথ, সেলাই শেষের পূর্বাভাস আর ফ্লোরের সতর্কতা এই সংখ্যাগুলো দিয়ে হিসাব হয়।" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField name="perLineDay" label="লাইনপ্রতি দৈনিক উৎপাদন" value={p.perLineDay} min={10} max={20000} suffix="পিস" />
        <NumberField name="fabricLeadDays" label="কাপড়ের লিড টাইম" value={p.fabricLeadDays} min={1} max={180} suffix="দিন" />
        <NumberField name="efficiencyAlert" label="এর নিচে দক্ষতা হলে সতর্ক করুন" value={p.efficiencyAlert} min={30} max={100} suffix="%" />
        <NumberField name="shipBufferDays" label="শিপমেন্টের কত দিন আগে সেলাই শেষ" value={p.shipBufferDays} min={0} max={60} suffix="দিন" />
        <NumberField name="shiftStart" label="শিফট শুরু (২৪ ঘণ্টার ঘড়িতে)" value={p.shiftStart} min={0} max={23} suffix="টা" />
        <NumberField name="hoursPerDay" label="দৈনিক কর্মঘণ্টা" value={p.hoursPerDay} min={1} max={24} suffix="ঘণ্টা" />
      </SectionForm>

      <SectionForm section="stages" title="অর্ডারের ধাপের নাম" lede="ধাপগুলোর ক্রম একই থাকে, নাম আপনার কারখানার ভাষায় দিন — যেমন সোয়েটার কারখানায় “কাটিং”-এর বদলে “নিটিং”, “সেলাই”-এর বদলে “লিংকিং”।" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((s) => (
          <label key={s} className="flex flex-col gap-1.5">
            <span className="label">{s}</span>
            <input name={s} defaultValue={config.stages[s]} required maxLength={80} className="field" />
          </label>
        ))}
      </SectionForm>

      <SectionForm section="departments" title="বিভাগ" lede="কর্মী, মাইলস্টোনের দায়িত্ব আর ব্যতিক্রমের তালিকায় এই বিভাগগুলো দেখা যায়।">
        <ListEditor key={JSON.stringify(config.departments)} fields={OPTION_FIELDS} initial={config.departments} blank={{ key: '', label: '' }} addLabel="বিভাগ যোগ করুন" />
      </SectionForm>

      <SectionForm section="machineTypes" title="মেশিনের ধরন" lede="রক্ষণাবেক্ষণে মেশিন যোগ করার সময় এই তালিকা থেকে ধরন বেছে নেওয়া হয়।">
        <ListEditor key={JSON.stringify(config.machineTypes)} fields={OPTION_FIELDS} initial={config.machineTypes} blank={{ key: '', label: '' }} addLabel="মেশিনের ধরন যোগ করুন" />
      </SectionForm>
    </>
  )
}
