const intFmt = new Intl.NumberFormat('en-US')

const tkFmt = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const bdtFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 })

const sign = (v: number) => (v < 0 ? '-' : '')

export const n = (v: number | null | undefined) => (v == null ? '—' : intFmt.format(Math.round(v)))
export const tk = (v: number | null | undefined) => (v == null ? '—' : `${sign(v)}৳${tkFmt.format(Math.abs(v))}`)
export function tkK(v: number) {
  const a = Math.abs(v)
  if (a >= 1e7) return `${sign(v)}৳${(a / 1e7).toFixed(2)} Cr`
  if (a >= 1e5) return `${sign(v)}৳${(a / 1e5).toFixed(1)} Lakh`
  return `${sign(v)}৳${bdtFmt.format(Math.round(a))}`
}
export const bdt = (v: number) => `${sign(v)}৳${bdtFmt.format(Math.round(Math.abs(v)))}`
/** A stored taka amount as an input default value. */
export const input = (v: number | null | undefined) => (v == null ? '' : Math.round(v * 100) / 100)
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
