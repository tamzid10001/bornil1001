import { redirect } from 'next/navigation'
import { getActor, grantsFor } from '@/lib/actor'
import { getConfig } from '@/lib/settings'
import { GATE_INFO, GATES, MODULES, today } from '@/lib/config'
import { NumberField, SectionForm } from '@/components/os/settings/section-form'

const NUMBERED = [
  { key: 'inquiry', label: 'ইনকোয়ারি' },
  { key: 'quote', label: 'কোটেশন' },
  { key: 'order', label: 'অর্ডার' },
  { key: 'invoice', label: 'কমার্শিয়াল ইনভয়েস' },
  { key: 'employee', label: 'শ্রমিক আইডি' },
] as const

export default async function WorkflowSettingsPage() {
  const [actor, config] = await Promise.all([getActor(), getConfig()])
  if (!grantsFor(actor)['settings.manage']) redirect('/os/settings/people')
  const year = today().slice(0, 4)

  return (
    <>
      <SectionForm section="modules" title="মডিউল" className="grid gap-2 sm:grid-cols-2">
        {MODULES.map((m) => (
          <label key={m.key} className="flex items-center gap-3 rounded-lg border border-rule px-3 py-2.5 text-sm has-[:checked]:border-foreground">
            <input type="checkbox" name={m.key} defaultChecked={config.modules[m.key]} className="size-4 accent-[var(--ink-fill)]" />
            {m.label}
          </label>
        ))}
      </SectionForm>

      <SectionForm section="gates" title="গেট" className="grid gap-2 sm:grid-cols-2">
        {GATES.map((g) => {
          const needsLc = (g === 'btb' || g === 'bl') && !config.modules.commercial
          return (
            <label key={g} className={`flex items-center gap-3 rounded-lg border border-rule px-3 py-2.5 text-sm has-[:checked]:border-foreground ${needsLc ? 'opacity-60' : ''}`}>
              <input type="checkbox" name={g} defaultChecked={config.gates[g]} disabled={needsLc} className="size-4 accent-[var(--ink-fill)]" />
              {GATE_INFO[g].label} গেট
              {needsLc ? <span className="ml-auto text-xs text-subtle">এলসি মডিউল বন্ধ</span> : null}
            </label>
          )
        })}
      </SectionForm>

      <SectionForm section="costing" title="কস্টিংয়ের শুরুর মান" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NumberField name="floorMargin" label="ন্যূনতম মার্জিন" value={config.costing.floorMargin} min={0} max={90} step="0.1" suffix="%" />
        <NumberField name="cmRate" label="প্রতি মিনিটে সিএম খরচ" value={config.costing.cmRate} min={0} max={10000} step="0.01" suffix="৳" />
        <NumberField name="fabricRate" label="কাপড়ের দর" value={config.costing.fabricRate} min={0} max={1000000} step="0.01" suffix="৳ / একক" />
        <NumberField name="overhead" label="পিসপ্রতি ওভারহেড" value={config.costing.overhead} min={0} max={1000000} step="0.01" suffix="৳" />
        <NumberField name="wastagePct" label="কাপড়ের অপচয়" value={config.costing.wastagePct} min={0} max={50} step="0.1" suffix="%" />
      </SectionForm>

      <SectionForm section="commercial" title="কমার্শিয়াল" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1.5">
          <span className="label">লোডিং বন্দর</span>
          <input name="portLoading" defaultValue={config.commercial.portLoading} required maxLength={60} className="field" />
        </label>
        <NumberField name="tenorDays" label="মাস্টার এলসির মেয়াদ" value={config.commercial.tenorDays} min={0} max={360} suffix="দিন" />
        <NumberField name="btbCap" label="বিটুবির সীমা (মাস্টারের)" value={config.commercial.btbCap} min={10} max={100} step="0.1" suffix="%" />
        <NumberField name="blTolerance" label="বি/এল পরিমাণে ছাড়" value={config.commercial.blTolerance} min={0} max={20} step="0.1" suffix="%" />
        <NumberField name="sourceTaxPct" label="রপ্তানি আয়ে উৎসে কর" value={config.commercial.sourceTaxPct} min={0} max={10} step="0.01" suffix="%" />
        <NumberField name="centralFundPct" label="কেন্দ্রীয় তহবিলে কর্তন" value={config.commercial.centralFundPct} min={0} max={1} step="0.01" suffix="%" />
        <NumberField name="presentationDays" label="জাহাজীকরণের পর কাগজ ব্যাংকে জমা" value={config.commercial.presentationDays} min={1} max={60} suffix="দিন" />
        <NumberField name="realisationDays" label="রপ্তানি আয় দেশে আনার সময়" value={config.commercial.realisationDays} min={30} max={360} suffix="দিন" />
      </SectionForm>

      <SectionForm section="numbering" title="নম্বরের ধরন" className="flex flex-col gap-2">
        {NUMBERED.map((k) => {
          const rule = config.numbering[k.key]
          const sample = `${rule.prefix.replaceAll('{YYYY}', year).replaceAll('{YY}', year.slice(2))}${'1'.padStart(rule.pad, '0')}`
          return (
            <div key={k.key} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[10rem_12rem_7rem_1fr]">
              <span className="col-span-2 pb-2 text-sm font-medium sm:col-span-1">{k.label}</span>
              <label className="flex flex-col gap-1.5">
                <span className="label">শুরুর অংশ</span>
                <input name={`${k.key}_prefix`} defaultValue={rule.prefix} placeholder="PO-{YYYY}-" maxLength={24} spellCheck={false} autoCapitalize="characters" className="field font-mono text-sm" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">অঙ্ক</span>
                <input name={`${k.key}_pad`} type="number" min={0} max={8} defaultValue={rule.pad} className="field num" />
              </label>
              <span className="col-span-2 pb-2 font-mono text-sm text-subtle sm:col-span-1">যেমন {sample}</span>
            </div>
          )
        })}
      </SectionForm>
    </>
  )
}
