export const STAGES = ['order', 'materials', 'cut', 'sew', 'qc', 'ship', 'paid'] as const
export type Stage = (typeof STAGES)[number]

export const ROLE_LABEL: Record<string, string> = {
  owner: 'owner',
  merchandiser: 'merchandiser',
  planner: 'planner',
  store: 'store',
  cutting: 'cutting master',
  sewing: 'line chief',
  qa: 'quality',
  commercial: 'commercial',
  mechanic: 'maintenance',
  hr: 'hr & payroll',
}

/** Which roles may pass each gate. The owner may pass every gate. */
export const GATE_ROLES = {
  costing: ['owner'],
  btb: ['commercial', 'store', 'merchandiser'],
  pp: ['qa', 'merchandiser'],
  bl: ['commercial'],
} as const

export type Gate = keyof typeof GATE_ROLES

export function canPass(gate: Gate, role: string | undefined) {
  if (!role) return false
  return role === 'owner' || (GATE_ROLES[gate] as readonly string[]).includes(role)
}

export function quoteCost(q: {
  fabricKg: number
  fabricRate: number
  cmMinutes: number
  cmRate: number
  trims: number
  overhead: number
}) {
  const fabric = q.fabricKg * q.fabricRate
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

/** Back-planned critical path, offsets in days before the ship date. */
export const TNA_TEMPLATE: { name: string; dept: string; offset: number }[] = [
  { name: 'lab dip approval', dept: 'merchandising', offset: 75 },
  { name: 'master lc received', dept: 'commercial', offset: 72 },
  { name: 'btb lc opened', dept: 'commercial', offset: 68 },
  { name: 'fabric booking', dept: 'store', offset: 66 },
  { name: 'trims booking', dept: 'store', offset: 60 },
  { name: 'fabric in-house', dept: 'store', offset: 40 },
  { name: 'pp sample approval', dept: 'merchandising', offset: 35 },
  { name: 'pp meeting', dept: 'quality', offset: 30 },
  { name: 'bulk cutting start', dept: 'cutting', offset: 28 },
  { name: 'sewing start', dept: 'sewing', offset: 25 },
  { name: 'sewing complete', dept: 'sewing', offset: 8 },
  { name: 'final inspection', dept: 'quality', offset: 5 },
  { name: 'ex-factory', dept: 'commercial', offset: 2 },
]

export const DEFECT_CODES: { code: string; label: string; bn: string }[] = [
  { code: 'D01', label: 'open seam', bn: 'সেলাই খোলা' },
  { code: 'D02', label: 'skip stitch', bn: 'স্টিচ বাদ' },
  { code: 'D03', label: 'broken stitch', bn: 'সেলাই ছেঁড়া' },
  { code: 'D04', label: 'uneven hem', bn: 'হেম অসমান' },
  { code: 'D05', label: 'oil stain', bn: 'তেলের দাগ' },
  { code: 'D06', label: 'shade variation', bn: 'রঙের তারতম্য' },
  { code: 'D07', label: 'measurement out', bn: 'মাপ ভুল' },
  { code: 'D08', label: 'puckering', bn: 'কুঁচকানো' },
  { code: 'D09', label: 'label misplaced', bn: 'লেবেল ভুল জায়গায়' },
]

/** ISO 2859-1, general inspection level II, single sampling, AQL 2.5 (major). */
export function aqlPlan(lotSize: number) {
  const table: [number, number, number][] = [
    [8, 2, 0],
    [15, 3, 0],
    [25, 5, 0],
    [50, 8, 0],
    [90, 13, 1],
    [150, 20, 1],
    [280, 32, 2],
    [500, 50, 3],
    [1200, 80, 5],
    [3200, 125, 7],
    [10000, 200, 10],
    [35000, 315, 14],
    [150000, 500, 21],
  ]
  for (const [max, sample, accept] of table) {
    if (lotSize <= max) return { sample, accept }
  }
  return { sample: 800, accept: 21 }
}

/** Bangladesh RMG minimum wage gazette (Dec 2023), gross per month in taka. */
export const WAGE_GRADES: Record<number, number> = {
  1: 14750,
  2: 14100,
  3: 13550,
  4: 13025,
  5: 12500,
}
const FIXED_ALLOWANCES = 750 + 450 + 1250
export const ATTENDANCE_BONUS = 450

export function wage(grade: number, daysPresent: number, otHours: number) {
  const gross = WAGE_GRADES[grade] ?? WAGE_GRADES[5]
  const basic = (gross - FIXED_ALLOWANCES) / 1.5
  const otRate = (basic / 208) * 2
  const earned = (gross * Math.min(daysPresent, 26)) / 26
  const bonus = daysPresent >= 26 ? ATTENDANCE_BONUS : 0
  const ot = otRate * otHours
  return { gross, basic, otRate, earned, bonus, ot, net: earned + bonus + ot }
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function today() {
  return new Date().toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
  )
}
