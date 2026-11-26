import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { audit } from '@/lib/db/schema'
import { getExceptions } from '@/lib/queries'
import { getConfig, getRoles } from '@/lib/settings'
import { getActor, grantsFor } from '@/lib/actor'
import { GATE_INFO, GATES } from '@/lib/config'
import { bn, stamp } from '@/lib/format'
import { Empty, PageHeader, Section, TextLink } from '@/components/os/ui'
import { acronyms } from '@/lib/acronyms'

export const metadata = { title: 'গেট ও অডিট' }

export default async function ApprovalsPage() {
  const [exceptions, trail, config, roles, actor] = await Promise.all([
    getExceptions(),
    db.select().from(audit).orderBy(desc(audit.at)).limit(100),
    getConfig(),
    getRoles(),
    getActor(),
  ])
  const can = grantsFor(actor)
  const held = exceptions.filter((e) => e.kind === 'gate')
  const holders = (perm: string) => roles.filter((r) => r.isOwner || r.permissions.includes(perm)).map((r) => r.name)

  return (
    <>
      <PageHeader eyebrow="নিয়ন্ত্রণ" title="গেট ও অডিট ট্রেইল" />

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="গেট" aside={can['settings.manage'] ? <TextLink href="/os/settings/workflow">গেট চালু বা বন্ধ করুন</TextLink> : null}>
          <ul className="flex flex-col">
            {GATES.map((gate) => {
              const info = GATE_INFO[gate]
              const on = config.gates[gate]
              return (
                <li key={gate} className="flex flex-col gap-1 border-t border-rule py-3 first:border-t-0">
                  <span className="flex items-center gap-2 font-medium">
                    {info.label} গেট
                    <span className={`rounded-full px-2 text-xs font-normal ${on ? 'bg-key text-foreground' : 'border border-rule text-subtle'}`}>{on ? 'চালু' : 'বন্ধ'}</span>
                  </span>
                  <span className="text-sm leading-relaxed text-muted">
                    {info.rule}
                    {gate === 'btb' ? `; মোট বিটুবি মাস্টার এলসির ${bn(config.commercial.btbCap)}%-এর বেশি নয়` : ''}।
                  </span>
                  <span className="text-xs text-subtle">ছাড় দিতে পারেন: {holders(info.permission).join(', ') || '—'}</span>
                </li>
              )
            })}
          </ul>
        </Section>
        <Section title={`এখন আটকে আছে · ${bn(held.length)}`}>
          {held.length === 0 ? (
            <Empty>কোনো গেটে কিছু আটকে নেই।</Empty>
          ) : (
            <ul className="flex flex-col">
              {held.map((e, i) => (
                <li key={i} className="border-t border-rule first:border-t-0">
                  <Link href={e.href} className="group flex flex-col py-3">
                    <span className="font-medium group-hover:text-ink">{e.title}</span>
                    <span className="text-sm text-muted">{e.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="অডিট ট্রেইল" aside={<span className="text-sm text-muted">সর্বশেষ {bn(trail.length)}টি</span>}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>কখন</th>
                <th>কে</th>
                <th>কী করেছেন</th>
                <th>বিস্তারিত</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((a) => (
                <tr key={a.id}>
                  <td className="num whitespace-nowrap text-muted">{stamp(a.at)}</td>
                  <td className="whitespace-nowrap">{a.actor}</td>
                  <td>{acronyms(a.action)}</td>
                  <td className="text-muted">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  )
}
