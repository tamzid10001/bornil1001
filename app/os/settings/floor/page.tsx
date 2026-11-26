import { redirect } from 'next/navigation'
import { getActor, grantsFor } from '@/lib/actor'
import { getFloorPlan } from '@/lib/settings'
import { LINE_KINDS } from '@/lib/config'
import { bn, n } from '@/lib/format'
import { ActionForm, Submit } from '@/components/os/action-form'
import { Empty, Section, Stat } from '@/components/os/ui'
import { deleteFloor, deleteLine, saveFloor, saveLine } from '../../actions/settings'

const COLS = 'lg:grid-cols-[1.2fr_1fr_6rem_6rem_4.5rem_auto]'

function KindSelect({ value, label }: { value: string; label: string }) {
  return (
    <select name="kind" defaultValue={value} aria-label={label} className="field h-9 text-sm">
      {Object.entries(LINE_KINDS).map(([k, v]) => (
        <option key={k} value={k}>
          {v}
        </option>
      ))}
    </select>
  )
}

export default async function FloorSettingsPage() {
  const [actor, plan] = await Promise.all([getActor(), getFloorPlan()])
  if (!grantsFor(actor)['settings.manage']) redirect('/os/settings/people')
  const live = plan.lines.filter((l) => l.active)

  return (
    <>
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Stat value={bn(plan.floors.length)} label="ফ্লোর" />
        <Stat value={bn(live.length)} label="চালু লাইন" />
        <Stat value={n(live.reduce((s, l) => s + l.operators, 0))} label="অপারেটর" />
        <Stat value={n(live.reduce((s, l) => s + l.hourlyTarget, 0))} label="ঘণ্টায় মোট লক্ষ্য (পিস)" />
      </div>

      {plan.floors.length === 0 ? <Empty>এখনো কোনো ফ্লোর নেই — নিচ থেকে প্রথম ফ্লোর যোগ করুন।</Empty> : null}

      {plan.floors.map((f) => {
        const rows = plan.lines.filter((l) => l.floorId === f.id)
        return (
          <Section key={f.id} title={f.building ? `${f.name} · ${f.building}` : f.name} aside={<span className="text-sm text-muted">{bn(rows.length)}টি লাইন</span>}>
            <div className="flex flex-wrap items-end gap-3">
              <ActionForm action={saveFloor} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="id" value={f.id} />
                <label className="flex flex-col gap-1.5">
                  <span className="label">ফ্লোরের নাম</span>
                  <input name="name" defaultValue={f.name} required maxLength={60} className="field h-9 w-40 text-sm" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="label">ভবন</span>
                  <input name="building" defaultValue={f.building ?? ''} maxLength={60} className="field h-9 w-40 text-sm" />
                </label>
                <Submit small quiet>
                  নাম সংরক্ষণ
                </Submit>
              </ActionForm>
              <ActionForm action={deleteFloor}>
                <input type="hidden" name="id" value={f.id} />
                <Submit small quiet danger disabled={rows.length > 0} confirm={`${f.name} মুছে ফেলবেন?`}>
                  ফ্লোর মুছুন
                </Submit>
              </ActionForm>
            </div>

            <div className={`hidden gap-2 px-1 lg:grid ${COLS}`} aria-hidden="true">
              {['লাইনের নাম', 'ধরন', 'ঘণ্টায় লক্ষ্য', 'অপারেটর', 'চালু', ''].map((h) => (
                <span key={h} className="label">
                  {h}
                </span>
              ))}
            </div>
            <ul className="flex flex-col gap-2">
              {rows.map((l) => (
                <li key={l.id} className="flex flex-col gap-1">
                  <ActionForm action={saveLine} className={`grid grid-cols-2 items-end gap-2 rounded-lg border border-rule p-3 lg:items-center lg:border-0 lg:p-0 ${COLS}`}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="floor_id" value={f.id} />
                    <label className="col-span-2 flex flex-col gap-1.5 lg:col-span-1">
                      <span className="label lg:sr-only">লাইনের নাম</span>
                      <input name="name" defaultValue={l.name} required maxLength={60} aria-label="লাইনের নাম" className="field h-9 text-sm" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="label lg:sr-only">ধরন</span>
                      <KindSelect value={l.kind} label={`${l.name}-এর ধরন`} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="label lg:sr-only">ঘণ্টায় লক্ষ্য</span>
                      <input name="hourly_target" type="number" min={1} max={5000} defaultValue={l.hourlyTarget} required aria-label={`${l.name}-এর ঘণ্টায় লক্ষ্য`} className="field num h-9 text-sm" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="label lg:sr-only">অপারেটর</span>
                      <input name="operators" type="number" min={0} max={1000} defaultValue={l.operators} required aria-label={`${l.name}-এর অপারেটর`} className="field num h-9 text-sm" />
                    </label>
                    <label className="flex h-9 items-center gap-2 text-sm">
                      <input type="checkbox" name="active" defaultChecked={l.active} className="size-4 accent-[var(--ink-fill)]" />
                      <span className="lg:sr-only">চালু</span>
                    </label>
                    <Submit small quiet>
                      সংরক্ষণ
                    </Submit>
                  </ActionForm>
                  <ActionForm action={deleteLine} className="flex justify-end">
                    <input type="hidden" name="id" value={l.id} />
                    <Submit small quiet danger confirm={`${l.name} মুছে ফেলবেন?`}>
                      মুছুন
                    </Submit>
                  </ActionForm>
                </li>
              ))}
            </ul>
            <ActionForm action={saveLine} resetOnSuccess className="grid grid-cols-2 items-end gap-2 rounded-xl border border-dashed border-rule p-3 sm:grid-cols-5">
              <input type="hidden" name="floor_id" value={f.id} />
              <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
                <span className="label">নতুন লাইন</span>
                <input name="name" required maxLength={60} placeholder={`লাইন ${bn(plan.lines.length + 1)}`} className="field h-9 text-sm" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">ধরন</span>
                <KindSelect value="sewing" label="নতুন লাইনের ধরন" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">ঘণ্টায় লক্ষ্য</span>
                <input name="hourly_target" type="number" min={1} max={5000} defaultValue={100} required className="field num h-9 text-sm" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="label">অপারেটর</span>
                <input name="operators" type="number" min={0} max={1000} defaultValue={0} required className="field num h-9 text-sm" />
              </label>
              <Submit small>লাইন যোগ করুন</Submit>
            </ActionForm>
          </Section>
        )
      })}

      <Section title="নতুন ফ্লোর">
        <ActionForm action={saveFloor} resetOnSuccess className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="label">ফ্লোরের নাম</span>
            <input name="name" required maxLength={60} placeholder={`ফ্লোর ${bn(plan.floors.length + 1)}`} className="field w-48" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label">ভবন (ঐচ্ছিক)</span>
            <input name="building" maxLength={60} className="field w-48" />
          </label>
          <Submit>ফ্লোর যোগ করুন</Submit>
        </ActionForm>
      </Section>
    </>
  )
}
