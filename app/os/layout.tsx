import type { Metadata } from 'next'
import Link from 'next/link'
import { getActor, grantsFor, listPeople } from '@/lib/actor'
import { NAV } from '@/lib/i18n'
import { getExceptions } from '@/lib/queries'
import { getConfig, getFactory, getRoles } from '@/lib/settings'
import { AutoSubmitSelect, Nav } from '@/components/os/nav'
import { BornilCredit, BornilLogo } from '@/components/os/logo'
import { BrandMark } from '@/components/os/brand'
import { MobileNav } from '@/components/os/mobile-nav'
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

  const homeLabel = `${factory.name}, মূল পাতা`
  const brand = (
    <Link href="/os" aria-label={homeLabel} className="flex min-w-0 items-center gap-3 px-3 text-foreground">
      <BrandMark brand={factory} />
      <span className="flex min-w-0 flex-col">
        <span className="line-clamp-2 font-heading text-sm font-semibold leading-snug">{factory.name}</span>
        {factory.nameEn ? <span className="truncate text-xs text-subtle">{factory.nameEn}</span> : null}
      </span>
    </Link>
  )
  const menu = (
    <>
      <div className="scroll-shade -mx-4 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-1">
        <Nav groups={groups} />
      </div>
      <div className="flex shrink-0 flex-col gap-4 border-t border-rule px-3 pt-4">
        <form action={setActor}>
          <AutoSubmitSelect name="actor" defaultValue={String(actor?.id ?? '')} label="বর্তমান ব্যবহারকারী">
            {active.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {roleName(p.role)}
              </option>
            ))}
          </AutoSubmitSelect>
        </form>
        <BornilCredit />
      </div>
    </>
  )

  return (
    <div className="flex min-h-dvh flex-col xl:flex-row">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-rule bg-background px-2.5 md:px-7.5 xl:hidden">
        <MobileNav brand={brand} alerts={badges['/os']}>
          {menu}
        </MobileNav>
        <Link href="/os" aria-label={homeLabel} className="flex min-w-0 items-center gap-2.5 rounded-lg px-1 text-foreground">
          <BrandMark brand={factory} />
          <span className="truncate font-heading text-sm font-semibold">{factory.name}</span>
        </Link>
      </header>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-rule px-4 py-5 xl:flex">
        {brand}
        {menu}
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          {children}
          <footer className="border-t border-rule pt-6 xl:hidden">
            <BornilCredit />
          </footer>
        </div>
      </main>
    </div>
  )
}
