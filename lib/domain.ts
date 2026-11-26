export const STAGES = ['order', 'materials', 'cut', 'sew', 'qc', 'ship', 'paid'] as const
export type Stage = (typeof STAGES)[number]

export const ROLE_LABEL: Record<string, string> = {
  owner: 'মালিক',
  merchandiser: 'মার্চেন্ডাইজার',
  planner: 'প্ল্যানার',
  store: 'স্টোর কিপার',
  cutting: 'কাটিং মাস্টার',
  sewing: 'লাইন চিফ',
  qa: 'মান নিয়ন্ত্রণ কর্মকর্তা',
  commercial: 'কমার্শিয়াল কর্মকর্তা',
  mechanic: 'মেকানিক',
  hr: 'এইচআর কর্মকর্তা',
}

export const STAGE_LABEL: Record<string, string> = {
  order: 'অর্ডার',
  materials: 'কাঁচামাল',
  cut: 'কাটিং',
  sew: 'সেলাই',
  qc: 'মান যাচাই',
  ship: 'শিপমেন্ট',
  paid: 'টাকা প্রাপ্তি',
}

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
}

export const DEPT_LABEL: Record<string, string> = {
  merchandising: 'মার্চেন্ডাইজিং',
  costing: 'কস্টিং',
  commercial: 'কমার্শিয়াল',
  store: 'স্টোর',
  quality: 'মান নিয়ন্ত্রণ',
  cutting: 'কাটিং',
  sewing: 'সেলাই',
  planning: 'প্ল্যানিং',
  maintenance: 'রক্ষণাবেক্ষণ',
  hr: 'এইচআর',
  management: 'ব্যবস্থাপনা',
  finishing: 'ফিনিশিং',
}

export const MACHINE_LABEL: Record<string, string> = {
  'single needle': 'সিঙ্গেল নিডল',
  overlock: 'ওভারলক',
  flatlock: 'ফ্ল্যাটলক',
  bartack: 'বারট্যাক',
  buttonhole: 'বাটনহোল',
  'button attach': 'বাটন অ্যাটাচ',
}

export const GATE_LABEL: Record<string, string> = {
  costing: 'কস্টিং',
  btb: 'বিটুবি',
  pp: 'পিপি',
  bl: 'বি/এল',
  'b/l': 'বি/এল',
}

/** Display label for any stored English key; falls back to the key itself. */
export const label = (map: Record<string, string>, key: string | null | undefined) => (key ? (map[key] ?? key) : '—')

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

export type PlanInputs = { lines: number; perLineDay: number; fabricLeadDays: number }

export const PLAN_DEFAULTS: PlanInputs = { lines: 4, perLineDay: 900, fabricLeadDays: 25 }

/**
 * Works the critical path backwards from the ship date. Each milestone's latest date is its
 * successor's date minus the work between them, so sewing length follows quantity and line
 * capacity, and fabric booking follows the supplier lead time.
 */
export function backSchedule(shipDate: string, quantity: number, p: PlanInputs) {
  const sewingDays = Math.ceil(quantity / Math.max(1, p.lines * p.perLineDay)) + 2
  const d: Record<string, string> = {}
  d['ex-factory'] = addDays(shipDate, -2)
  d['final inspection'] = addDays(d['ex-factory'], -2)
  d['sewing complete'] = addDays(d['final inspection'], -3)
  d['sewing start'] = addDays(d['sewing complete'], -sewingDays)
  d['bulk cutting start'] = addDays(d['sewing start'], -3)
  d['pp meeting'] = addDays(d['bulk cutting start'], -2)
  d['pp sample approval'] = addDays(d['pp meeting'], -4)
  d['fabric in-house'] = addDays(d['bulk cutting start'], -4)
  d['trims booking'] = addDays(d['sewing start'], -20)
  d['fabric booking'] = addDays(d['fabric in-house'], -p.fabricLeadDays)
  d['btb lc opened'] = addDays(d['fabric booking'], -2)
  d['lab dip approval'] = addDays(d['fabric booking'], -3)
  d['master lc received'] = addDays(d['btb lc opened'], -4)

  const rows = TNA_TEMPLATE.map((m) => ({ name: m.name, dept: m.dept, due: d[m.name] }))
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((m, i) => ({ ...m, sort: i }))
  const start = rows[0].due
  return { rows, sewingDays, start, slack: daysBetween(today(), start) }
}

export const TNA_LABEL: Record<string, string> = {
  'lab dip approval': 'ল্যাব ডিপ অনুমোদন',
  'master lc received': 'মাস্টার এলসি প্রাপ্তি',
  'btb lc opened': 'বিটুবি এলসি খোলা',
  'fabric booking': 'কাপড় বুকিং',
  'trims booking': 'ট্রিমস বুকিং',
  'fabric in-house': 'কাপড় কারখানায় পৌঁছানো',
  'pp sample approval': 'পিপি স্যাম্পল অনুমোদন',
  'pp meeting': 'পিপি মিটিং',
  'bulk cutting start': 'বাল্ক কাটিং শুরু',
  'sewing start': 'সেলাই শুরু',
  'sewing complete': 'সেলাই সম্পন্ন',
  'final inspection': 'চূড়ান্ত পরিদর্শন',
  'ex-factory': 'এক্স-ফ্যাক্টরি',
}

export const DEFECT_CODES: { code: string; label: string; bn: string }[] = [
  { code: 'D01', label: 'open seam', bn: 'সেলাই খোলা' },
  { code: 'D02', label: 'skip stitch', bn: 'ফোঁড় বাদ পড়া' },
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
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
}

export function daysBetween(a: string, b: string) {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000,
  )
}
