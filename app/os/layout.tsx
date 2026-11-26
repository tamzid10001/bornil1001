import Link from 'next/link'
import { getActor, listPeople } from '@/lib/actor'
import { getLang, NAV } from '@/lib/i18n'
import { getExceptions } from '@/lib/queries'
import { ROLE_LABEL } from '@/lib/domain'
import { AutoSubmitSelect, Nav } from '@/components/os/nav'
import { BornilLogo } from '@/components/os/logo'
import { loadExampleFactory, setActor } from './actions/shell'

export const dynamic = 'force-dynamic'

export default async function OsLayout({ children }: { children: React.ReactNode }) {
  const [staff, actor, lang] = await Promise.all([listPeople(), getActor(), getLang()])

  if (!staff.length) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-16">
        <BornilLogo className="h-10 w-auto self-start text-foreground" />
        <h1 className="text-4xl leading-tight">কারখানা এখনো খালি।</h1>
        <p className="leading-relaxed text-muted">
          একটি নমুনা কারখানা লোড করুন — দশজন কর্মী, ভিন্ন ভিন্ন ধাপে চারটি অর্ডার, চারটি সেলাই লাইন, ঋণপত্র ও একটি বেতন
          তালিকা — যাতে বায়ারের ইমেইল থেকে ব্যাংকে টাকা আসা পর্যন্ত একটি অর্ডার পুরোটা দেখে নিতে পারেন।
        </p>
        <form action={loadExampleFactory}>
          <button type="submit" className="btn">
            নমুনা কারখানা লোড করুন
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
        <Link href="/os" aria-label="বর্ণিল RMG, হোম" className="flex items-center gap-3 px-3 text-foreground">
          <BornilLogo className="h-7 w-auto" />
          <span aria-hidden="true" className="h-5 w-px bg-rule" />
          <span className="font-heading text-sm font-semibold tracking-widest">RMG</span>
        </Link>
        <Nav groups={groups} />
        <div className="mt-auto flex flex-col gap-4 border-t border-rule px-3 pt-4">
          <form action={setActor}>
            <AutoSubmitSelect name="actor" defaultValue={String(actor?.id ?? '')} label="যিনি কাজ করছেন">
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {ROLE_LABEL[p.role] ?? p.role}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">{children}</div>
      </main>
    </div>
  )
}
