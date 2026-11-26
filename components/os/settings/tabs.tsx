'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SettingsTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const path = usePathname()
  return (
    <nav aria-label="সেটিংসের ভাগ" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 border-b border-rule px-1">
        {tabs.map((t) => {
          const active = t.href === '/os/settings' ? path === t.href : path.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px flex h-10 items-center border-b-2 px-3 text-sm transition-colors ${
                  active ? 'border-ink-fill font-medium text-foreground' : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
