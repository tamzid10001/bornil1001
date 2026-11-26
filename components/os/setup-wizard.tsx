'use client'

import { useActionState, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { DEFAULT_CATEGORIES, LINE_KINDS, MODULES } from '@/lib/config'
import type { ActionState } from '@/lib/action'

const STEPS = ['কারখানা', 'মালিক', 'ফ্লোর প্ল্যান', 'পোশাক ও মডিউল'] as const

function Finish() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="btn">
      {pending ? 'তৈরি হচ্ছে…' : 'কারখানা চালু করুন'}
    </button>
  )
}

/** Four short steps, one form: nothing is saved until the last step, so going back is free. */
export function SetupWizard({ action }: { action: (state: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [state, formAction] = useActionState(action, null)
  const [step, setStep] = useState(0)
  const sets = useRef<(HTMLFieldSetElement | null)[]>([])

  const next = () => {
    const fs = sets.current[step]
    const invalid = fs ? Array.from(fs.querySelectorAll<HTMLInputElement>('input, select')).find((el) => !el.checkValidity()) : undefined
    if (invalid) {
      invalid.reportValidity()
      return
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <ol className="flex flex-wrap gap-x-6 gap-y-2" aria-label="ধাপ">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? 'step' : undefined} className={`flex items-center gap-2 text-sm ${i === step ? 'font-medium text-foreground' : 'text-subtle'}`}>
            <span className={`flex size-6 items-center justify-center rounded-full text-xs ${i < step ? 'bg-ok text-on-ink' : i === step ? 'bg-ink-fill text-on-ink' : 'bg-key'}`}>
              {'১২৩৪'[i]}
            </span>
            {s}
          </li>
        ))}
      </ol>

      <fieldset ref={(el) => void (sets.current[0] = el)} hidden={step !== 0} className="flex flex-col gap-5">
        <legend className="sr-only">কারখানার পরিচয়</legend>
        <label className="flex flex-col gap-1.5">
          <span className="label">কারখানার নাম (বাংলায়)</span>
          <input name="name" required maxLength={120} className="field" placeholder="যেমন মেঘনা নিটওয়্যার লিমিটেড" />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">ইংরেজি নাম (রপ্তানির কাগজে)</span>
            <input name="name_en" maxLength={120} className="field" placeholder="Meghna Knitwear Ltd." />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">এক লাইনে পরিচিতি</span>
            <input name="tagline" maxLength={160} className="field" placeholder="নিট ও ওভেন পোশাক রপ্তানিকারক" />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="label">লোগো (ঐচ্ছিক · PNG, JPG, WebP বা SVG · ৫১২ কেবি পর্যন্ত)</span>
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-key file:px-4 file:py-2 file:text-sm file:font-medium" />
        </label>
      </fieldset>

      <fieldset ref={(el) => void (sets.current[1] = el)} hidden={step !== 1} className="flex flex-col gap-5">
        <legend className="sr-only">মালিকের তথ্য</legend>
        <p className="text-sm leading-relaxed text-muted">আপনিই প্রথম মালিক — সব অনুমতি আপনার থাকবে। পরে সেটিংস থেকে কর্মী যোগ করে প্রত্যেককে ভূমিকা দেবেন।</p>
        <label className="flex flex-col gap-1.5">
          <span className="label">আপনার নাম</span>
          <input name="owner_name" required maxLength={120} className="field" autoComplete="name" />
        </label>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">ইমেইল</span>
            <input name="owner_email" type="email" maxLength={200} className="field" autoComplete="email" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">ফোন</span>
            <input name="owner_phone" type="tel" maxLength={40} className="field" autoComplete="tel" />
          </label>
        </div>
      </fieldset>

      <fieldset ref={(el) => void (sets.current[2] = el)} hidden={step !== 2} className="flex flex-col gap-5">
        <legend className="sr-only">ফ্লোর প্ল্যান</legend>
        <p className="text-sm leading-relaxed text-muted">একটা শুরুর কাঠামো দিন। পরে প্রতিটি ফ্লোর ও লাইনের নাম, ধরন, লক্ষ্য ও অপারেটর আলাদা করে বদলাতে পারবেন।</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="label">কতটি ফ্লোর</span>
            <input name="floors" type="number" min={1} max={30} defaultValue={1} required className="field num" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">প্রতি ফ্লোরে কতটি লাইন</span>
            <input name="lines_per_floor" type="number" min={0} max={80} defaultValue={4} required className="field num" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">লাইনের ধরন</span>
            <select name="line_kind" defaultValue="sewing" className="field">
              {Object.entries(LINE_KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">লাইনপ্রতি ঘণ্টায় লক্ষ্য (পিস)</span>
            <input name="hourly_target" type="number" min={1} max={5000} defaultValue={100} required className="field num" />
          </label>
        </div>
      </fieldset>

      <fieldset ref={(el) => void (sets.current[3] = el)} hidden={step !== 3} className="flex flex-col gap-6">
        <legend className="sr-only">পোশাক ও মডিউল</legend>
        <div className="flex flex-col gap-2">
          <span className="label">কোন ধরনের পোশাক বানান</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEFAULT_CATEGORIES.map((c, i) => (
              <label key={c.key} className="flex items-start gap-3 rounded-lg border border-rule px-3 py-2.5 text-sm has-[:checked]:border-foreground">
                <input type="checkbox" name="categories" value={c.key} defaultChecked={i < 2} className="mt-0.5 size-4 accent-[var(--ink-fill)]" />
                <span className="flex flex-col">
                  {c.label}
                  <span className="text-xs text-subtle">
                    কাপড় {c.unit} · সাইজ {c.sizes.join(' ')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="label">কোন মডিউল চালু থাকবে</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODULES.map((m) => (
              <label key={m.key} className="flex items-start gap-3 rounded-lg border border-rule px-3 py-2.5 text-sm has-[:checked]:border-foreground">
                <input type="checkbox" name={`module_${m.key}`} defaultChecked className="mt-0.5 size-4 accent-[var(--ink-fill)]" />
                <span className="flex flex-col">
                  {m.label}
                  <span className="text-xs text-subtle">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {state?.error ? (
        <p role="alert" className="rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {step > 0 ? (
          <button type="button" onClick={() => setStep((s) => s - 1)} className="btn-quiet">
            আগের ধাপ
          </button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="btn">
            পরের ধাপ
          </button>
        ) : (
          <Finish />
        )}
      </div>
    </form>
  )
}
