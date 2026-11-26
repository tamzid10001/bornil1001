import Link from 'next/link'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { audit } from '@/lib/db/schema'
import { getExceptions } from '@/lib/queries'
import { GATE_ROLES, ROLE_LABEL } from '@/lib/domain'
import { stamp } from '@/lib/format'
import { Empty, PageHeader, Section } from '@/components/os/ui'

export const metadata = { title: 'gates & audit' }

const GATE_RULE: Record<string, string> = {
  costing: 'a quote under the margin floor cannot reach the buyer',
  btb: 'imported fabric and trims cannot be booked before the btb lc is opened, and btb cannot exceed 75% of the master lc',
  pp: 'bulk sewing output is refused until the pp meeting is signed',
  bl: 'documents cannot go to the bank while the b/l disagrees with the lc',
}

export default async function ApprovalsPage() {
  const [exceptions, trail] = await Promise.all([getExceptions(), db.select().from(audit).orderBy(desc(audit.at)).limit(100)])
  const held = exceptions.filter((e) => e.kind === 'gate')

  return (
    <>
      <PageHeader
        eyebrow="control"
        title="Gates and the audit trail"
        lede="Four gates stop an order from moving until the right person signs. Every signature, and every action, is written here with a name and a time."
      />

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="the four gates">
          <ul className="flex flex-col">
            {Object.entries(GATE_ROLES).map(([gate, roles]) => (
              <li key={gate} className="flex flex-col gap-1 border-t border-rule py-3 first:border-t-0">
                <span className="font-medium">{gate === 'bl' ? 'b/l' : gate} gate</span>
                <span className="text-sm leading-relaxed text-muted">{GATE_RULE[gate]}.</span>
                <span className="text-xs text-subtle">passed by: owner, {roles.map((r) => ROLE_LABEL[r] ?? r).join(', ')}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title={`held now · ${held.length}`}>
          {held.length === 0 ? (
            <Empty>Nothing is waiting at a gate.</Empty>
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

      <Section title="audit trail" aside={<span className="text-sm text-muted">last {trail.length}</span>}>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>when</th>
                <th>who</th>
                <th>did</th>
                <th>detail</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((a) => (
                <tr key={a.id}>
                  <td className="num whitespace-nowrap text-muted">{stamp(a.at)}</td>
                  <td className="whitespace-nowrap">{a.actor}</td>
                  <td>{a.action}</td>
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
