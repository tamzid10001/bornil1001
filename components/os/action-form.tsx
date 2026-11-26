'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/lib/action'

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  className?: string
  resetOnSuccess?: boolean
  hideOk?: boolean
}

export function ActionForm({ action, children, className, resetOnSuccess, hideOk }: Props) {
  const [state, formAction] = useActionState(action, null)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error ? (
        <p role="alert" className="basis-full rounded-lg bg-alert-soft px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok && !hideOk ? (
        <p role="status" className="basis-full text-sm text-ok">
          {state.ok}
        </p>
      ) : null}
    </form>
  )
}

export function Submit({
  children,
  quiet,
  small,
  disabled,
  name,
  value,
}: {
  children: React.ReactNode
  quiet?: boolean
  small?: boolean
  disabled?: boolean
  name?: string
  value?: string
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending || disabled}
      aria-busy={pending}
      className={`${quiet ? 'btn-quiet' : 'btn'} ${small ? 'btn-sm' : ''}`}
    >
      {pending ? 'working…' : children}
    </button>
  )
}
