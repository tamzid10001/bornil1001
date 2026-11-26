import { redirect } from 'next/navigation'
import { getActor, grantsFor } from '@/lib/actor'
import { getFactory } from '@/lib/settings'
import { ActionForm, Submit } from '@/components/os/action-form'
import { BrandMark } from '@/components/os/brand'
import { Section, TextLink } from '@/components/os/ui'
import { removeLogo, saveLogo, saveProfile } from '../actions/settings'

function Field({ name, label, value, type = 'text', wide, placeholder }: { name: string; label: string; value: string | null; type?: string; wide?: boolean; placeholder?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <span className="label">{label}</span>
      <input name={name} type={type} defaultValue={value ?? ''} placeholder={placeholder} className="field" />
    </label>
  )
}

export default async function ProfileSettingsPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const [factory, actor, { welcome }] = await Promise.all([getFactory(), getActor(), searchParams])
  if (!grantsFor(actor)['settings.manage']) redirect('/os/settings/people')

  return (
    <>
      {welcome ? (
        <div className="flex flex-col gap-1 rounded-xl border border-ok/40 px-4 py-3 text-sm" role="status">
          <p className="font-medium text-ok">{factory.name} চালু হয়েছে।</p>
          <p className="leading-relaxed text-muted">
            এবার <TextLink href="/os/settings/people">কর্মী যোগ করে ভূমিকা দিন</TextLink>, <TextLink href="/os/settings/floor">ফ্লোর প্ল্যান মিলিয়ে নিন</TextLink>, তারপর{' '}
            <TextLink href="/os/orders">প্রথম অর্ডার নিন</TextLink>।
          </p>
        </div>
      ) : null}

      <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
        <Section title="পরিচয়">
          <ActionForm action={saveProfile} className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="label">কারখানার নাম (বাংলায়)</span>
              <input name="name" defaultValue={factory.name} required maxLength={120} className="field" />
            </label>
            <Field name="name_en" label="ইংরেজি নাম (রপ্তানির কাগজে)" value={factory.nameEn} />
            <Field name="tagline" label="এক লাইনে পরিচিতি" value={factory.tagline} />
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="label">ঠিকানা</span>
              <textarea name="address" rows={2} defaultValue={factory.address ?? ''} maxLength={300} className="field" />
            </label>
            <Field name="phone" label="ফোন" value={factory.phone} type="tel" />
            <Field name="email" label="ইমেইল" value={factory.email} type="email" />
            <Field name="website" label="ওয়েবসাইট" value={factory.website} placeholder="https://" />
            <Field name="membership" label="বিজিএমইএ / বিকেএমইএ সদস্য নম্বর" value={factory.membership} />
            <Field name="erc" label="রপ্তানি নিবন্ধন (ইআরসি)" value={factory.erc} />
            <Field name="irc" label="আমদানি নিবন্ধন (আইআরসি)" value={factory.irc} />
            <Field name="bin" label="ভ্যাট নিবন্ধন (বিআইএন)" value={factory.bin} />
            <div className="sm:col-span-2">
              <Submit>সংরক্ষণ করুন</Submit>
            </div>
          </ActionForm>
        </Section>

        <Section title="লোগো">
          <div className="flex items-center gap-3 rounded-xl border border-rule p-4">
            <BrandMark brand={factory} size="lg" />
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-heading font-semibold">{factory.name}</span>
              {factory.nameEn ? <span className="truncate text-xs text-subtle">{factory.nameEn}</span> : null}
            </span>
          </div>
          <ActionForm action={saveLogo} resetOnSuccess className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="label">নতুন লোগো · PNG, JPG, WebP বা SVG · ৫১২ কেবি পর্যন্ত</span>
              <input
                name="logo"
                type="file"
                required
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-key file:px-4 file:py-2 file:text-sm file:font-medium"
              />
            </label>
            <div>
              <Submit small>লোগো আপলোড করুন</Submit>
            </div>
          </ActionForm>
          {factory.logoUrl ? (
            <ActionForm action={removeLogo}>
              <Submit small quiet danger confirm="লোগো সরিয়ে দেবেন?">
                লোগো সরান
              </Submit>
            </ActionForm>
          ) : null}
        </Section>
      </div>
    </>
  )
}
