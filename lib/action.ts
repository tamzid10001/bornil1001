export type ActionState = { error?: string; ok?: string } | null

export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn()
    return { ok: ok ?? 'saved' }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Something went wrong.'
    if (message === 'NEXT_REDIRECT' || (e as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw e
    console.error('[v0] action failed:', message)
    return { error: message }
  }
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export function num(fd: FormData, key: string, { min = -Infinity, max = Infinity } = {}) {
  const raw = str(fd, key)
  const v = Number(raw)
  if (raw === '' || !Number.isFinite(v)) throw new Error(`${key.replace(/_/g, ' ')} must be a number.`)
  if (v < min || v > max) throw new Error(`${key.replace(/_/g, ' ')} must be between ${min} and ${max}.`)
  return v
}

export function int(fd: FormData, key: string, opts?: { min?: number; max?: number }) {
  const v = num(fd, key, opts)
  if (!Number.isInteger(v)) throw new Error(`${key.replace(/_/g, ' ')} must be a whole number.`)
  return v
}

export function isoDate(fd: FormData, key: string) {
  const v = str(fd, key)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${key.replace(/_/g, ' ')} must be a date.`)
  return v
}
