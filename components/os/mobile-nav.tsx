'use client'

import { useRef } from 'react'
import { Menu, X } from 'lucide-react'
import { bn } from '@/lib/format'

/** Menu button and slide-in drawer that carry the sidebar on phones and tablets. */
export function MobileNav({ brand, alerts, children }: { brand: React.ReactNode; alerts: number; children: React.ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)

  function open() {
    dialog.current?.showModal()
    closeButton.current?.focus()
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-key"
      >
        <Menu className="size-5" aria-hidden="true" />
        <span className="sr-only">মেনু খুলুন{alerts ? `, ${bn(alerts)}টি ব্যতিক্রম` : ''}</span>
        {alerts ? (
          <span
            aria-hidden="true"
            className="num absolute right-0.5 top-0.5 min-w-4 rounded-full bg-alert px-1 text-center text-xs font-medium leading-4 text-on-ink"
          >
            {alerts}
          </span>
        ) : null}
      </button>
      <dialog
        ref={dialog}
        aria-label="মেনু"
        className="drawer"
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as Element).closest('a')) dialog.current?.close()
        }}
      >
        <div className="flex h-full flex-col gap-6 px-4 py-5">
          <div className="flex items-start justify-between gap-2">
            {brand}
            <button
              ref={closeButton}
              type="button"
              onClick={() => dialog.current?.close()}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-key hover:text-foreground"
            >
              <X className="size-5" aria-hidden="true" />
              <span className="sr-only">মেনু বন্ধ করুন</span>
            </button>
          </div>
          {children}
        </div>
      </dialog>
    </>
  )
}
