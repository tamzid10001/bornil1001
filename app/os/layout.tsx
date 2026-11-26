import type { Metadata } from 'next'
import Link from 'next/link'
import { getActor, grantsFor, listPeople } from '@/lib/actor'
import { NAV } from '@/lib/i18n'
import { getExceptions } from '@/lib/queries'
import { getConfig, getFactory, getRoles } from '@/lib/settings'
import { AutoSubmitSelect, Nav } from '@/components/os/nav'
import { BornilLogo } from '@/components/os/logo'
import { BrandMark } from '@/components/os/brand'
import { SetupWizard } from '@/components/os/setup-wizard'
import { loadExampleFactory, setActor } from './actions/shell'
import { setupFactory } from './actions/settings'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const f = await getFactory()
  if (!f.exists) return { title: 'কারখানা সেটআপ' }
  return {
    title: { default: f.name, template: `%s · ${f.name}` },
    ...(f.logoUrl ? { icons: { icon: f.logoUrl } } : {}),
  }
}

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const [staff, factory] = await Promise.all([listPeople(), getFactory()])

  if (!staff.length) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-10 px-6 py-16">
        <header className="flex flex-col gap-4">
          <BornilLogo className="h-9 w-auto self-start text-foreground" />
          <h1 className="text-balance text-4xl leading-tight">আপনার কারখানা সেটআপ করুন</h1>
        </header>
        <SetupWizard action={setupFactory} />
        <form action={loadExampleFactory} className="border-t border-rule pt-6">
          <button type="submit" className="btn-quiet">
            নমুনা কারখানা দেখুন
          </button>
        </form>
      </main>
    )
  }

  const [actor, config, roles, exceptions] = await Promise.all([getActor(), getConfig(), getRoles(), getExceptions()])
  const can = grantsFor(actor)
  const badges: Record<string, number> = {
    '/os': exceptions.filter((e) => e.kind !== 'info').length,
    '/os/approvals': exceptions.filter((e) => e.kind === 'gate').length,
  }
  const groups = NAV.map((g) => ({
    label: g.group,
    items: g.items
      .filter((i) => (!i.module || config.modules[i.module]) && (!i.permission || i.permission.some((p) => can[p])))
      .map((i) => ({ href: i.href, label: i.label, icon: i.icon, badge: badges[i.href] ?? 0 })),
  })).filter((g) => g.items.length)
  const roleName = (key: string) => roles.find((r) => r.key === key)?.name ?? key
  const active = staff.filter((p) => p.active)

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex flex-col gap-6 border-b border-rule px-4 py-5 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Link href="/os" aria-label={`${factory.name}, মূল পাতা`} className="flex items-center gap-3 px-3 text-foreground">
          <BrandMark brand={factory} />
          <span className="flex min-w-0 flex-col">
            <span className="line-clamp-2 font-heading text-sm font-semibold leading-snug">{factory.name}</span>
            {factory.nameEn ? <span className="truncate text-xs text-subtle">{factory.nameEn}</span> : null}
          </span>
        </Link>
        <Nav groups={groups} />
        <div className="mt-auto flex flex-col gap-4 border-t border-rule px-3 pt-4">
          <form action={setActor}>
            <AutoSubmitSelect name="actor" defaultValue={String(actor?.id ?? '')} label="বর্তমান ব্যবহারকারী">
              {active.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {roleName(p.role)}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
          <p className="flex items-center gap-2 text-xs text-subtle">
            <BornilLogo className="h-3 w-auto" />
            <span>দিয়ে চালিত</span>
          </p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">{children}</div>
      </main>
    </div>
  )
}
