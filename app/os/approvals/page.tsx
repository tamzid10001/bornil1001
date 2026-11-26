import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { audit } from '@/lib/db/schema'
import { getExceptions } from '@/lib/queries'
import { GATE_LABEL, GATE_ROLES, ROLE_LABEL } from '@/lib/domain'
import { bn, stamp } from '@/lib/format'
import { Empty, PageHeader, Section } from '@/components/os/ui'
import { acronyms } from '@/lib/acronyms'

export const metadata = { title: 'গেট ও অডিট' }

const GATE_RULE: Record<string, string> = {
  costing: 'ন্যূনতম মার্জিনের নিচের কোটেশন বায়ারের কাছে যাবে না',
  btb: 'বিটুবি এলসি খোলার আগে আমদানি করা কাপড় ও ট্রিমস বুক করা যাবে না, এবং বিটুবি মাস্টার এলসির ৭৫%-এর বেশি হতে পারবে না',
  pp: 'পিপি মিটিং স্বাক্ষর না হওয়া পর্যন্ত বাল্ক সেলাইয়ের আউটপুট নেওয়া হবে না',
  bl: 'বি/এল এলসির সঙ্গে না মেলা পর্যন্ত ডকুমেন্ট ব্যাংকে যাবে না',
}

export default async function ApprovalsPage() {
  const [exceptions, trail] = await Promise.all([getExceptions(), db.select().from(audit).orderBy(desc(audit.at)).limit(100)])
  const held = exceptions.filter((e) => e.kind === 'gate')

  return (
    <>
      <PageHeader
        eyebrow="নিয়ন্ত্রণ"
        title="গেট ও অডিট ট্রেইল"
      />

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="চারটি গেট">
          <ul className="flex flex-col">
            {Object.entries(GATE_ROLES).map(([gate, roles]) => (
              <li key={gate} className="flex flex-col gap-1 border-t border-rule py-3 first:border-t-0">
                <span className="font-medium">{GATE_LABEL[gate] ?? acronyms(gate)} গেট</span>
                <span className="text-sm leading-relaxed text-muted">{GATE_RULE[gate]}।</span>
                <span className="text-xs text-subtle">অনুমোদন দিতে পারেন: মালিক, {roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}</span>
              </li>
            ))}
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
