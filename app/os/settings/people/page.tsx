import { getActor, grantsFor, listPeople } from '@/lib/actor'
import { getConfig, getRoles } from '@/lib/settings'
import { PERMISSION_GROUPS, PERMISSIONS } from '@/lib/config'
import { bn } from '@/lib/format'
import type { Role } from '@/lib/db/schema'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Chip, Section } from '@/components/os/ui'
import { deleteRole, savePerson, saveRole } from '../../actions/settings'

const GROUPED = Object.entries(PERMISSION_GROUPS).map(([group, label]) => ({ label, items: PERMISSIONS.filter((p) => p.group === group) }))

function Permissions({ role, editable }: { role?: Role; editable: boolean }) {
  if (role?.isOwner) return <p className="text-sm text-muted">মালিকের সব অনুমতি থাকে — এটি বদলানো যায় না।</p>
  return (
    <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      {GROUPED.map((g) => (
        <fieldset key={g.label} className="flex flex-col gap-1.5">
          <legend className="label mb-1">{g.label}</legend>
          {g.items.map((p) => (
            <label key={p.key} className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="permissions" value={p.key} defaultChecked={role?.permissions.includes(p.key)} disabled={!editable} className="mt-0.5 size-4 shrink-0 accent-[var(--ink-fill)]" />
              {p.label}
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  )
}

export default async function PeopleSettingsPage() {
  const [actor, roles, staff, config] = await Promise.all([getActor(), getRoles(), listPeople(), getConfig()])
  const can = grantsFor(actor)
  const isOwner = !!actor?.isOwner
  const count = (key: string) => staff.filter((p) => p.role === key).length
  const assignable = roles.filter((r) => isOwner || !r.isOwner)

  return (
    <>
      <Section
        title="ভূমিকা ও অনুমতি"
        aside={<span className="text-sm text-muted">{isOwner ? `${bn(roles.length)}টি ভূমিকা` : 'শুধু মালিক বদলাতে পারেন'}</span>}
      >
        <ul className="flex flex-col">
          {roles.map((r) => (
            <li key={r.id} className="border-t border-rule first:border-t-0">
              <details className="group py-3">
                <summary className="flex w-full flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-subtle">
                    {bn(count(r.key))} জন · {r.isOwner ? 'সব অনুমতি' : `${bn(r.permissions.length)}টি অনুমতি`}
                  </span>
                </summary>
                <div className="flex flex-col gap-4 pt-4">
                  <ActionForm action={saveRole} className="flex flex-col gap-4">
                    <input type="hidden" name="id" value={r.id} />
                    <label className="flex max-w-sm flex-col gap-1.5">
                      <span className="label">ভূমিকার নাম</span>
                      <input name="name" defaultValue={r.name} required maxLength={60} disabled={!isOwner} className="field" />
                    </label>
                    <Permissions role={r} editable={isOwner} />
                    {isOwner ? (
                      <div>
                        <Submit small>সংরক্ষণ করুন</Submit>
                      </div>
                    ) : null}
                  </ActionForm>
                  {isOwner && !r.isOwner ? (
                    <ActionForm action={deleteRole}>
                      <input type="hidden" name="id" value={r.id} />
                      <Submit small quiet danger disabled={count(r.key) > 0} confirm={`“${r.name}” ভূমিকাটি মুছে ফেলবেন?`}>
                        {count(r.key) > 0 ? 'কর্মী আছে বলে মোছা যাবে না' : 'ভূমিকা মুছুন'}
                      </Submit>
                    </ActionForm>
                  ) : null}
                </div>
              </details>
            </li>
          ))}
        </ul>
        {isOwner ? (
          <details className="rounded-xl border border-rule p-4">
            <summary className="font-medium">নতুন ভূমিকা তৈরি করুন</summary>
            <ActionForm action={saveRole} resetOnSuccess className="flex flex-col gap-4 pt-4">
              <label className="flex max-w-sm flex-col gap-1.5">
                <span className="label">ভূমিকার নাম</span>
                <input name="name" required maxLength={60} placeholder="যেমন ওয়াশিং ইনচার্জ, আইই ম্যানেজার" className="field" />
              </label>
              <Permissions editable />
              <div>
                <Submit small>ভূমিকা তৈরি করুন</Submit>
              </div>
            </ActionForm>
          </details>
        ) : null}
      </Section>

      {can['staff.manage'] ? (
        <Section title="কর্মী" aside={<span className="text-sm text-muted">{bn(staff.filter((p) => p.active).length)} জন সক্রিয়</span>}>
          <div className="hidden gap-2 px-1 lg:grid lg:grid-cols-[1.3fr_1fr_1fr_1.3fr_0.9fr_4.5rem_6rem]" aria-hidden="true">
            {['নাম', 'ভূমিকা', 'বিভাগ', 'ইমেইল', 'ফোন', 'সক্রিয়', ''].map((h) => (
              <span key={h} className="label">
                {h}
              </span>
            ))}
          </div>
          <ul className="flex flex-col gap-2">
            {staff.map((p) => {
              const role = roles.find((r) => r.key === p.role)
              const locked = !!role?.isOwner && !isOwner
              return (
                <li key={p.id}>
                  <ActionForm action={savePerson} className="grid grid-cols-2 items-center gap-2 rounded-lg border border-rule p-3 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr_0.9fr_4.5rem_6rem] lg:border-0 lg:p-0">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="name" defaultValue={p.name} required disabled={locked} aria-label="নাম" className="field col-span-2 h-9 text-sm lg:col-span-1" />
                    <select name="role" defaultValue={p.role} disabled={locked} aria-label={`${p.name}-এর ভূমিকা`} className="field h-9 text-sm">
                      {(locked ? roles : assignable).map((r) => (
                        <option key={r.key} value={r.key}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <select name="dept" defaultValue={p.dept} disabled={locked} aria-label={`${p.name}-এর বিভাগ`} className="field h-9 text-sm">
                      {config.departments.map((d) => (
                        <option key={d.key} value={d.key}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                    <input name="email" type="email" defaultValue={p.email ?? ''} disabled={locked} aria-label={`${p.name}-এর ইমেইল`} placeholder="ইমেইল" className="field h-9 text-sm" />
                    <input name="phone" type="tel" defaultValue={p.phone ?? ''} disabled={locked} aria-label={`${p.name}-এর ফোন`} placeholder="ফোন" className="field h-9 text-sm" />
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={p.active} disabled={locked} className="size-4 accent-[var(--ink-fill)]" />
                      <span className="lg:sr-only">সক্রিয়</span>
                    </label>
                    {locked ? <Chip status="closed">মালিক</Chip> : <Submit small quiet>সংরক্ষণ</Submit>}
                  </ActionForm>
                </li>
              )
            })}
          </ul>
          <details className="rounded-xl border border-rule p-4" open={staff.length < 2}>
            <summary className="font-medium">কর্মী যোগ করুন</summary>
            <ActionForm action={savePerson} resetOnSuccess className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="flex flex-col gap-1.5">
                <span className="label">নাম</span>
                <input name="name" required maxLength={120} className="field" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">ভূমিকা</span>
                <select name="role" required defaultValue={assignable.find((r) => !r.isOwner)?.key} className="field">
                  {assignable.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">বিভাগ</span>
                <select name="dept" required className="field">
                  {config.departments.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">ইমেইল</span>
                <input name="email" type="email" className="field" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">ফোন</span>
                <input name="phone" type="tel" className="field" />
              </label>
              <div className="sm:col-span-2 lg:col-span-5">
                <Submit small>যোগ করুন</Submit>
              </div>
            </ActionForm>
          </details>
        </Section>
      ) : null}
    </>
  )
}
