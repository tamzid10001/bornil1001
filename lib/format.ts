const intFmt = new Intl.NumberFormat('bn-BD')

const tkFmt = new Intl.NumberFormat('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const bdtFmt = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 0 })

const sign = (v: number) => (v < 0 ? '-' : '')

export const n = (v: number | null | undefined) => (v == null ? '—' : intFmt.format(Math.round(v)))
export const tk = (v: number | null | undefined) => (v == null ? '—' : `${sign(v)}৳${tkFmt.format(Math.abs(v))}`)
export function tkK(v: number) {
  const a = Math.abs(v)
  if (a >= 1e7) return `${sign(v)}৳${bn((a / 1e7).toFixed(2))} কোটি`
  if (a >= 1e5) return `${sign(v)}৳${bn((a / 1e5).toFixed(1))} লাখ`
  return `${sign(v)}৳${bdtFmt.format(Math.round(a))}`
}
export const bdt = (v: number) => `${sign(v)}৳${bdtFmt.format(Math.round(Math.abs(v)))}`
/** A stored taka amount as an input default value. */
export const input = (v: number | null | undefined) => (v == null ? '' : Math.round(v * 100) / 100)
export const pct = (v: number, digits = 1) => `${bn(v.toFixed(digits))}%`

export function day(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  return d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

const stampDate = new Intl.DateTimeFormat('bn-BD', { day: 'numeric', month: 'long', timeZone: 'Asia/Dhaka' })
const stampTime = new Intl.DateTimeFormat('bn-BD', { hour: 'numeric', minute: '2-digit', dayPeriod: 'short', timeZone: 'Asia/Dhaka' })

/** Dhaka time with the part of day first, as it is spoken: "২৬ নভেম্বর, রাত ১১:৩১". ICU says the formal "রাত্রি". */
export function stamp(v: Date | string | null | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  const t = Object.fromEntries(stampTime.formatToParts(d).map((p) => [p.type, p.value]))
  const period = t.dayPeriod === 'রাত্রি' ? 'রাত' : t.dayPeriod
  return `${stampDate.format(d)}, ${period} ${t.hour}:${t.minute}`
}

const bnDigits = '০১২৩৪৫৬৭৮৯'
export const bn = (v: number | string) => String(v).replace(/\d/g, (d) => bnDigits[Number(d)])

export function localDay(d: Date) {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
}

const kgFmt = new Intl.NumberFormat('bn-BD', { maximumFractionDigits: 1 })
export const kg = (v: number | null | undefined) => (v == null ? '—' : kgFmt.format(Math.round(v * 10) / 10))
