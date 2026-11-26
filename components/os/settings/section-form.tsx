import type { SectionKey } from '@/lib/config'
import { ActionForm, Submit } from '@/components/os/action-form'
import { resetSettings, saveSettings } from '@/app/os/actions/settings'

/** One settings section: its own save, plus a way back to the defaults a new factory starts with. */
export function SectionForm({
  section,
  title,
  lede,
  children,
  className = 'flex flex-col gap-4',
}: {
  section: SectionKey
  title: string
  lede?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className="flex flex-col gap-4 border-t border-rule pt-8 first:border-t-0 first:pt-0" aria-labelledby={`s-${section}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 id={`s-${section}`} className="text-xl">
            {title}
          </h2>
          {lede ? <p className="text-pretty text-sm leading-relaxed text-muted">{lede}</p> : null}
        </div>
        <ActionForm action={resetSettings} className="flex shrink-0 flex-col items-end gap-1">
          <input type="hidden" name="section" value={section} />
          <Submit quiet small confirm={`“${title}” শুরুর অবস্থায় ফেরাবেন? আপনার পরিবর্তনগুলো মুছে যাবে।`}>
            শুরুর অবস্থায় ফেরান
          </Submit>
        </ActionForm>
      </div>
      <ActionForm action={saveSettings} className={className}>
        <input type="hidden" name="section" value={section} />
        {children}
        <div className="col-span-full">
          <Submit small>সংরক্ষণ করুন</Submit>
        </div>
      </ActionForm>
    </section>
  )
}

export function NumberField({ name, label, value, min, max, step, suffix }: { name: string; label: string; value: number; min: number; max: number; step?: string; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      <span className="flex items-center gap-2">
        <input name={name} type="number" defaultValue={value} min={min} max={max} step={step} required className="field num" />
        {suffix ? <span className="shrink-0 text-xs text-subtle">{suffix}</span> : null}
      </span>
    </label>
  )
}
