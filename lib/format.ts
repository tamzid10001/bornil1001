const intFmt = new Intl.NumberFormat('en-US')
const usdFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const bdtFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

export const n = (v: number | null | undefined) => (v == null ? '—' : intFmt.format(Math.round(v)))
export const usd = (v: number | null | undefined) => (v == null ? '—' : usdFmt.format(v))
export const usdK = (v: number) =>
  v >= 1000 ? `$${(v / 1000).toFixed(v >= 100000 ? 0 : 1)}k` : usdFmt.format(v)
export const bdt = (v: number) => `৳${bdtFmt.format(Math.round(v))}`
export const pct = (v: number, digits = 1) => `${v.toFixed(digits)}%`

export function day(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).toLowerCase()
}

export function stamp(v: Date | string | null | undefined) {
  if (!v) return '—'
  const d = typeof v === 'string' ? new Date(v) : v
  return d
    .toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Dhaka',
    })
    .toLowerCase()
}

const bnDigits = '০১২৩৪৫৬৭৮৯'
export const bn = (v: number | string) => String(v).replace(/\d/g, (d) => bnDigits[Number(d)])
