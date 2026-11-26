import Link from 'next/link'
import { GATE_LABEL, STAGES, STATUS_LABEL } from '@/lib/domain'
import { DEFAULT_STAGES } from '@/lib/config'
import { acronyms } from '@/lib/acronyms'

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  hideTitle,
  divider = true,
}: {
  eyebrow?: string
  title: string
  lede?: React.ReactNode
  actions?: React.ReactNode
  hideTitle?: boolean
  divider?: boolean
}) {
  return (
    <header
      className={`flex flex-col gap-4 md:flex-row md:items-end md:justify-between ${divider ? 'border-b border-rule pb-6' : ''}`}
    >
      <div className="flex max-w-2xl flex-col gap-2">
        {eyebrow ? <p className="label">{eyebrow}</p> : null}
        <h1 className={hideTitle ? 'sr-only' : 'text-3xl leading-tight md:text-4xl'}>{title}</h1>
        {lede ? <p className="text-pretty leading-relaxed text-muted">{lede}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  )
}

const CHIP: Record<string, string> = {
  draft: 'bg-key text-muted',
  pending: 'bg-key text-muted',
  requested: 'bg-key text-muted',
  running: 'bg-key text-foreground',
  held: 'bg-alert-soft text-alert',
  discrepant: 'bg-alert-soft text-alert',
  down: 'bg-alert-soft text-alert',
  rejected: 'bg-alert-soft text-alert',
  late: 'bg-alert-soft text-alert',
  released: 'border border-ok text-ok',
  issued: 'border border-ok text-ok',
  opened: 'border border-ok text-ok',
  booked: 'border border-ok text-ok',
  accepted: 'border border-ok text-ok',
  confirmed: 'border border-ok text-ok',
  sent: 'border border-ok text-ok',
  closed: 'border border-rule text-muted',
  done: 'border border-ok text-ok',
}

export function Chip({ status, children }: { status: string; children?: React.ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${CHIP[status] ?? 'bg-key text-muted'}`}>
      {children ?? STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function Stat({ value, label, tone }: { value: React.ReactNode; label: string; tone?: 'alert' | 'ok' }) {
  return (
    <div className="flex flex-col gap-1 border-t border-rule pt-3">
      <p className={`num font-heading text-3xl font-semibold ${tone === 'alert' ? 'text-alert' : tone === 'ok' ? 'text-ok' : ''}`}>
        {value}
      </p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  )
}

export function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-rule px-4 py-6 text-center text-sm text-muted">{children}</p>
}

export function StageRail({ stage, labels = DEFAULT_STAGES }: { stage: string; labels?: Record<string, string> }) {
  const idx = STAGES.indexOf(stage as (typeof STAGES)[number])
  return (
    <ol className="flex items-center gap-1" aria-label={`ধাপ: ${labels[stage] ?? stage}`}>
      {STAGES.map((s, i) => (
        <li key={s} className="flex items-center gap-1" title={labels[s]}>
          <span
            className={`block h-1.5 w-5 rounded-full ${i < idx ? 'bg-foreground' : i === idx ? 'bg-ink-fill' : 'bg-rule'}`}
          />
          <span className="sr-only">
            {labels[s]}
            {i === idx ? ' (চলমান)' : i < idx ? ' (সম্পন্ন)' : ''}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function GateNote({ gate, open, children }: { gate: string; open: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-3 ${
        open ? 'border-ok/40 text-muted' : 'border-alert/40 bg-alert-soft text-alert'
      }`}
    >
      <span className={`shrink-0 font-medium ${open ? 'text-ok' : ''}`}>
        {GATE_LABEL[gate] ?? acronyms(gate)} গেট · {open ? 'খোলা' : 'বন্ধ'}
      </span>
      <span className="leading-relaxed">{children}</span>
    </div>
  )
}

/** Shown in place of a page whose module the factory has switched off. */
export function ModuleOff({ title, canChange }: { title: string; canChange: boolean }) {
  return (
    <>
      <PageHeader title={title} />
      <Empty>
        এই কারখানায় “{title}” মডিউলটি বন্ধ রাখা আছে।{' '}
        {canChange ? <TextLink href="/os/settings/workflow">সেটিংস থেকে চালু করুন</TextLink> : 'চালু করতে মালিকের সঙ্গে কথা বলুন।'}
      </Empty>
    </>
  )
}

export function NoAccess({ title, what }: { title: string; what: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Empty>{what} দেখার অনুমতি আপনার ভূমিকায় নেই। মালিক সেটিংস → ভূমিকা থেকে অনুমতি দিতে পারেন।</Empty>
    </>
  )
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-ink underline decoration-1 underline-offset-4 hover:decoration-2">
      {children}
    </Link>
  )
}
