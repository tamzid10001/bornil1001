import { GATE_INFO } from './config'

export { STAGES, addDays, today, daysBetween, type Stage } from './config'

export const STATUS_LABEL: Record<string, string> = {
  new: 'নতুন',
  draft: 'খসড়া',
  pending: 'অপেক্ষমাণ',
  requested: 'অনুরোধ করা হয়েছে',
  running: 'চলছে',
  held: 'আটকে আছে',
  discrepant: 'অমিল',
  down: 'বন্ধ',
  rejected: 'প্রত্যাখ্যাত',
  late: 'বিলম্বিত',
  released: 'ছাড় দেওয়া হয়েছে',
  issued: 'ইস্যু হয়েছে',
  opened: 'খোলা হয়েছে',
  booked: 'বুক করা হয়েছে',
  accepted: 'গৃহীত',
  confirmed: 'নিশ্চিত',
  sent: 'পাঠানো হয়েছে',
  closed: 'বন্ধ হয়েছে',
  done: 'সম্পন্ন',
  quoted: 'দর দেওয়া হয়েছে',
  won: 'অর্ডার পাওয়া গেছে',
  lost: 'হাতছাড়া',
  received: 'পাওয়া গেছে',
  amended: 'সংশোধিত',
  matured: 'মেয়াদপূর্ণ',
  settled: 'পরিশোধিত',
  pass: 'পাস',
  fail: 'ফেল',
  passed: 'পাস',
  failed: 'ফেল',
  open: 'খোলা',
  approved: 'অনুমোদিত',
  submitted: 'জমা দেওয়া হয়েছে',
  realised: 'টাকা এসেছে',
  active: 'সক্রিয়',
  inactive: 'নিষ্ক্রিয়',
}

export const GATE_LABEL: Record<string, string> = {
  ...Object.fromEntries(Object.entries(GATE_INFO).map(([k, v]) => [k, v.label])),
  'b/l': 'বি/এল',
}

/** Display label for any stored English key; falls back to the key itself. */
export const label = (map: Record<string, string>, key: string | null | undefined) => (key ? (map[key] ?? key) : '—')

export function quoteCost(q: { fabricQty: number; fabricRate: number; cmMinutes: number; cmRate: number; trims: number; overhead: number }) {
  const fabric = q.fabricQty * q.fabricRate
  const cm = q.cmMinutes * q.cmRate
  const cost = fabric + cm + q.trims + q.overhead
  return { fabric, cm, trims: q.trims, overhead: q.overhead, cost }
}

export function quoteMargin(q: Parameters<typeof quoteCost>[0] & { fob: number }) {
  const { cost } = quoteCost(q)
  const margin = q.fob - cost
  const pct = q.fob > 0 ? (margin / q.fob) * 100 : 0
  return { cost, margin, pct }
}
