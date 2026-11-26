import Link from 'next/link'
import { getActor, listPeople } from '@/lib/actor'
import { getLang, NAV } from '@/lib/i18n'
import { getExceptions } from '@/lib/queries'
import { ROLE_LABEL } from '@/lib/domain'
import { AutoSubmitSelect, Nav } from '@/components/os/nav'
import { loadExampleFactory, setActor, setLang } from './actions/shell'

export const dynamic = 'force-dynamic'

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const [staff, actor, lang] = await Promise.all([listPeople(), getActor(), getLang()])

  if (!staff.length) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-16">
        <p className="font-heading text-2xl font-semibold">বর্ণিল | RMG</p>
        <h1 className="text-4xl leading-tight">The factory is empty.</h1>
        <p className="leading-relaxed text-muted">
          Load an example factory — ten staff, four orders at different stages, four sewing lines, letters of credit and a
          payroll — so you can walk one order from buyer email to bank realisation.
        </p>
        <form action={loadExampleFactory}>
          <button type="submit" className="btn">
            load the example factory
          </button>
        </form>
      </main>
    )
  }

  const exceptions = await getExceptions()
  const badges: Record<string, number> = {
    '/os': exceptions.filter((e) => e.kind !== 'info').length,
    '/os/approvals': exceptions.filter((e) => e.kind === 'gate').length,
  }
  const groups = NAV.map((g) => ({
    label: g.group[lang],
    items: g.items.map((i) => ({ href: i.href, label: i[lang], icon: i.icon, badge: badges[i.href] ?? 0 })),
  }))

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex flex-col gap-6 border-b border-rule px-4 py-5 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <Link href="/os" className="px-3 font-heading text-xl font-semibold">
          বর্ণিল <span className="font-normal text-subtle">|</span> RMG
        </Link>
        <Nav groups={groups} />
        <div className="mt-auto flex flex-col gap-4 border-t border-rule px-3 pt-4">
          <form action={setActor}>
            <AutoSubmitSelect name="actor" defaultValue={String(actor?.id ?? '')} label={lang === 'bn' ? 'যিনি কাজ করছেন' : 'acting as'}>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {ROLE_LABEL[p.role] ?? p.role}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
          <form action={setLang} className="flex gap-1" aria-label="language">
            {(['en', 'bn'] as const).map((l) => (
              <button
                key={l}
                type="submit"
                name="lang"
                value={l}
                aria-pressed={lang === l}
                className={`h-8 flex-1 rounded-full text-sm ${lang === l ? 'bg-foreground text-background' : 'bg-key text-muted hover:text-foreground'}`}
              >
                {l === 'en' ? 'english' : 'বাংলা'}
              </button>
            ))}
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">{children}</div>
      </main>
    </div>
  )
}
