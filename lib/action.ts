export type ActionState = { error?: string; ok?: string } | null

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
const bnNum = (v: number | string) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)])
const asciiDigits = (s: string) => s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))

export async function run(fn: () => Promise<string | void>): Promise<ActionState> {
  try {
    const ok = await fn()
    return { ok: ok ?? 'সংরক্ষণ করা হয়েছে' }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'একটি সমস্যা হয়েছে। আবার চেষ্টা করুন।'
    if (message === 'NEXT_REDIRECT' || (e as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw e
    console.error('[v0] action failed:', message)
    return { error: message }
  }
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key)
  return typeof v === 'string' ? v.trim() : ''
}

export function num(fd: FormData, key: string, { min = -Infinity, max = Infinity, label }: { min?: number; max?: number; label?: string } = {}) {
  const name = label ?? 'এই ঘর'
  const raw = asciiDigits(str(fd, key))
  const v = Number(raw)
  if (raw === '' || !Number.isFinite(v)) throw new Error(`${name}: একটি সংখ্যা দিন।`)
  if (v < min || v > max) {
    const range = Number.isFinite(max) ? `${bnNum(min)} থেকে ${bnNum(max)}-এর মধ্যে` : `কমপক্ষে ${bnNum(min)}`
    throw new Error(`${name} ${range} হতে হবে।`)
  }
  return v
}

export function int(fd: FormData, key: string, opts?: { min?: number; max?: number; label?: string }) {
  const v = num(fd, key, opts)
  if (!Number.isInteger(v)) throw new Error(`${opts?.label ?? 'এই ঘর'}: পূর্ণসংখ্যা দিন।`)
  return v
}

export function isoDate(fd: FormData, key: string) {
  const v = asciiDigits(str(fd, key))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error('একটি সঠিক তারিখ দিন।')
  return v
}
