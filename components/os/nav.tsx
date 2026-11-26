'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  Calculator,
  Landmark,
  Mail,
  Moon,
  Package,
  Settings,
  Shield,
  Stamp,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  moon: Moon,
  mail: Mail,
  calculator: Calculator,
  package: Package,
  activity: Activity,
  shield: Shield,
  wrench: Wrench,
  landmark: Landmark,
  wallet: Wallet,
  stamp: Stamp,
  settings: Settings,
}

type Group = { label: string; items: { href: string; label: string; icon: string; badge?: number }[] }

export function Nav({ groups }: { groups: Group[] }) {
  const path = usePathname()
  return (
    <nav aria-label="বিভাগসমূহ" className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-1">
          <p className="label px-3 pb-1">{g.label}</p>
          {g.items.map((item) => {
            const active = item.href === '/os' ? path === '/os' : path.startsWith(item.href)
            const Icon = ICONS[item.icon]
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active ? 'bg-key font-medium text-foreground' : 'text-muted hover:bg-key hover:text-foreground'
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="num rounded-full bg-alert px-1.5 text-xs font-medium text-on-ink">{item.badge}</span>
                ) : null}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

export function AutoSubmitSelect({
  name,
  defaultValue,
  label,
  children,
}: {
  name: string
  defaultValue: string
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="field h-9 text-sm"
      >
        {children}
      </select>
    </label>
  )
}
