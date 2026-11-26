import { z } from 'zod'

/*
 * Everything a factory can change about how the system behaves, with the defaults a
 * new factory starts from. Pure module: safe to import from server and client code.
 */

export const STAGES = ['order', 'materials', 'cut', 'sew', 'qc', 'ship', 'paid'] as const
export type Stage = (typeof STAGES)[number]

/* ---------- access ---------- */

export const PERMISSION_GROUPS = {
  sales: 'বিক্রয় ও কস্টিং',
  planning: 'পরিকল্পনা',
  materials: 'কাঁচামাল ও গুদাম',
  production: 'উৎপাদন ও মান',
  commercial: 'কমার্শিয়াল',
  gates: 'গেট ছাড়',
  people: 'জনবল ও বেতন',
  admin: 'প্রশাসন',
} as const

export const PERMISSIONS = [
  { key: 'inquiry.manage', group: 'sales', label: 'ইনকোয়ারি লেখা ও নিশ্চিত করা' },
  { key: 'costing.edit', group: 'sales', label: 'কস্ট শিট তৈরি, জমা ও ক্রেতাকে পাঠানো' },
  { key: 'order.create', group: 'sales', label: 'নতুন অর্ডার নেওয়া' },
  { key: 'plan.manage', group: 'planning', label: 'ক্রিটিক্যাল পাথ হিসাব ও নিশ্চিত করা' },
  { key: 'tna.any', group: 'planning', label: 'যেকোনো বিভাগের মাইলস্টোন সম্পন্ন করা' },
  { key: 'materials.book', group: 'materials', label: 'কাঁচামাল বুক করা ও বিটুবির আবেদন' },
  { key: 'bond.manage', group: 'materials', label: 'বন্ডেড গুদামের হিসাব লেখা' },
  { key: 'techpack.manage', group: 'materials', label: 'টেক প্যাক যোগ ও ট্রিম বিওএম-এ তোলা' },
  { key: 'cutting.record', group: 'production', label: 'কাটিংয়ের লে লেখা' },
  { key: 'sewing.record', group: 'production', label: 'লাইনের ঘণ্টাভিত্তিক আউটপুট লেখা' },
  { key: 'quality.record', group: 'production', label: 'ইনলাইন ত্রুটি লেখা' },
  { key: 'quality.inspect', group: 'production', label: 'চূড়ান্ত পরিদর্শনের সিদ্ধান্ত দেওয়া' },
  { key: 'maintenance.report', group: 'production', label: 'মেশিন ব্রেকডাউন জানানো' },
  { key: 'maintenance.manage', group: 'production', label: 'মেশিন যোগ ও টিকিট বন্ধ করা' },
  { key: 'commercial.manage', group: 'commercial', label: 'এলসি, ইউডি, সংশোধনী, ইনভয়েস ও টাকা প্রাপ্তি' },
  { key: 'packing.manage', group: 'commercial', label: 'প্যাকিং লিস্ট তৈরি করা' },
  { key: 'gate.costing', group: 'gates', label: 'কস্টিং গেট: ন্যূনতম মার্জিনের নিচে ছাড়' },
  { key: 'gate.btb', group: 'gates', label: 'বিটুবি গেট: বিটুবি এলসি খোলা' },
  { key: 'gate.pp', group: 'gates', label: 'পিপি গেট: পিপি মিটিংয়ে স্বাক্ষর' },
  { key: 'gate.bl', group: 'gates', label: 'বি/এল গেট: কাগজপত্র ব্যাংকে পাঠানো' },
  { key: 'payroll.view', group: 'people', label: 'বেতন তালিকা দেখা' },
  { key: 'payroll.manage', group: 'people', label: 'হাজিরা হালনাগাদ ও শ্রমিক যোগ' },
  { key: 'staff.manage', group: 'admin', label: 'কর্মী ও ভূমিকা ব্যবস্থাপনা' },
  { key: 'settings.manage', group: 'admin', label: 'কারখানার প্রোফাইল ও সেটিংস' },
] as const

export type Permission = (typeof PERMISSIONS)[number]['key']
export const PERMISSION_KEYS: readonly string[] = PERMISSIONS.map((p) => p.key)
export const PERMISSION_LABEL = Object.fromEntries(PERMISSIONS.map((p) => [p.key, p.label])) as Record<Permission, string>

export const GATES = ['costing', 'btb', 'pp', 'bl'] as const
export type Gate = (typeof GATES)[number]

export const GATE_INFO: Record<Gate, { label: string; permission: Permission; rule: string }> = {
  costing: { label: 'কস্টিং', permission: 'gate.costing', rule: 'ন্যূনতম মার্জিনের নিচের কোটেশন অনুমোদন ছাড়া ক্রেতার কাছে যায় না' },
  btb: { label: 'বিটুবি', permission: 'gate.btb', rule: 'বিটুবি এলসি না খোলা পর্যন্ত আমদানি করা কাঁচামাল বুক হয় না' },
  pp: { label: 'পিপি', permission: 'gate.pp', rule: 'পিপি মিটিংয়ে স্বাক্ষর ছাড়া বাল্ক সেলাইয়ের আউটপুট নেওয়া হয় না' },
  bl: { label: 'বি/এল', permission: 'gate.bl', rule: 'এলসির সঙ্গে না মিললে বি/এল ও কাগজপত্র ব্যাংকে যায় না' },
}

export const DEFAULT_ROLES: { key: string; name: string; isOwner?: boolean; permissions: Permission[] }[] = [
  { key: 'owner', name: 'মালিক', isOwner: true, permissions: [] },
  {
    key: 'merchandiser',
    name: 'মার্চেন্ডাইজার',
    permissions: ['inquiry.manage', 'costing.edit', 'order.create', 'plan.manage', 'materials.book', 'techpack.manage', 'quality.record', 'maintenance.report', 'gate.btb', 'gate.pp'],
  },
  { key: 'planner', name: 'প্ল্যানার', permissions: ['plan.manage', 'tna.any', 'sewing.record', 'quality.record', 'maintenance.report'] },
  { key: 'store', name: 'স্টোর কিপার', permissions: ['materials.book', 'bond.manage', 'techpack.manage', 'packing.manage', 'maintenance.report', 'gate.btb'] },
  { key: 'cutting', name: 'কাটিং মাস্টার', permissions: ['cutting.record', 'maintenance.report'] },
  { key: 'sewing', name: 'লাইন চিফ', permissions: ['sewing.record', 'quality.record', 'maintenance.report'] },
  { key: 'qa', name: 'মান নিয়ন্ত্রণ কর্মকর্তা', permissions: ['quality.record', 'quality.inspect', 'packing.manage', 'maintenance.report', 'gate.pp'] },
  { key: 'commercial', name: 'কমার্শিয়াল কর্মকর্তা', permissions: ['commercial.manage', 'materials.book', 'bond.manage', 'packing.manage', 'maintenance.report', 'gate.btb', 'gate.bl'] },
  { key: 'mechanic', name: 'মেকানিক', permissions: ['maintenance.report', 'maintenance.manage'] },
  { key: 'hr', name: 'এইচআর কর্মকর্তা', permissions: ['payroll.view', 'payroll.manage', 'maintenance.report'] },
]

/* ---------- modules ---------- */

export const MODULES = [
  { key: 'inquiries', label: 'ইনকোয়ারি' },
  { key: 'costing', label: 'কস্টিং ও কোটেশন' },
  { key: 'commercial', label: 'এলসি ও রপ্তানির কাগজ' },
  { key: 'bond', label: 'ইউডি ও বন্ডেড গুদাম' },
  { key: 'techpack', label: 'টেক প্যাক' },
  { key: 'maintenance', label: 'রক্ষণাবেক্ষণ' },
  { key: 'payroll', label: 'বেতন' },
] as const

export type ModuleKey = (typeof MODULES)[number]['key']

/* ---------- vocabularies ---------- */

export const LINE_KINDS: Record<string, string> = {
  sewing: 'সেলাই',
  cutting: 'কাটিং',
  finishing: 'ফিনিশিং',
  knitting: 'নিটিং',
  linking: 'লিংকিং',
  washing: 'ওয়াশিং',
  printing: 'প্রিন্ট ও এমব্রয়ডারি',
}

export const UNITS: Record<string, string> = {
  kg: 'কেজি',
  lb: 'পাউন্ড',
  yd: 'গজ',
  m: 'মিটার',
  pcs: 'পিস',
  pc: 'পিস',
  set: 'সেট',
  dz: 'ডজন',
  cone: 'কোন',
  roll: 'রোল',
}

export const unitLabel = (u: string | null | undefined) => (u ? (UNITS[u] ?? u) : '')

export type Option = { key: string; label: string }
export type Category = { key: string; label: string; unit: string; sizes: string[]; ratio: number[] }
export type Defect = { code: string; label: string }
export type Span = 'none' | 'sewing' | 'fabricLead'
export type Milestone = { key: string; label: string; dept: string; anchor: string; days: number; span: Span; categories: string[] }

export const optionLabel = (list: Option[], key: string | null | undefined) => (key ? (list.find((o) => o.key === key)?.label ?? key) : '—')

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'

/** A line's name from the floor plan, or a numbered fallback for rows recorded before it existed. */
export function lineName(all: { id: number; name: string }[], id: number | null | undefined) {
  if (id == null) return '—'
  return all.find((l) => l.id === id)?.name ?? `লাইন ${String(id).replace(/\d/g, (d) => BN_DIGITS[Number(d)])}`
}

export const DEFAULT_CATEGORIES: Category[] = [
  { key: 'knit-top', label: 'নিট টপ — টি-শার্ট, পোলো', unit: 'kg', sizes: ['S', 'M', 'L', 'XL', 'XXL'], ratio: [1, 3, 3, 2, 1] },
  { key: 'knit-fleece', label: 'ফ্লিস — সোয়েটশার্ট, হুডি', unit: 'kg', sizes: ['S', 'M', 'L', 'XL'], ratio: [2, 3, 3, 2] },
  { key: 'woven-top', label: 'ওভেন শার্ট', unit: 'yd', sizes: ['S', 'M', 'L', 'XL', 'XXL'], ratio: [1, 3, 3, 2, 1] },
  { key: 'woven-bottom', label: 'ওভেন প্যান্ট ও চিনো', unit: 'yd', sizes: ['30', '32', '34', '36', '38'], ratio: [2, 3, 3, 2, 1] },
  { key: 'denim', label: 'ডেনিম', unit: 'yd', sizes: ['28', '30', '32', '34', '36'], ratio: [1, 2, 3, 2, 1] },
  { key: 'sweater', label: 'সোয়েটার', unit: 'lb', sizes: ['S', 'M', 'L', 'XL'], ratio: [2, 3, 3, 2] },
  { key: 'outerwear', label: 'জ্যাকেট ও আউটারওয়্যার', unit: 'm', sizes: ['S', 'M', 'L', 'XL', 'XXL'], ratio: [1, 2, 3, 2, 1] },
  { key: 'kids', label: 'শিশুদের পোশাক', unit: 'kg', sizes: ['2Y', '4Y', '6Y', '8Y', '10Y'], ratio: [1, 2, 2, 2, 1] },
  { key: 'intimates', label: 'ইনটিমেট ও অন্তর্বাস', unit: 'm', sizes: ['XS', 'S', 'M', 'L', 'XL'], ratio: [1, 2, 3, 2, 1] },
]

export const DEFAULT_DEPARTMENTS: Option[] = [
  { key: 'management', label: 'ব্যবস্থাপনা' },
  { key: 'merchandising', label: 'মার্চেন্ডাইজিং' },
  { key: 'costing', label: 'কস্টিং' },
  { key: 'planning', label: 'প্ল্যানিং' },
  { key: 'commercial', label: 'কমার্শিয়াল' },
  { key: 'store', label: 'স্টোর' },
  { key: 'cutting', label: 'কাটিং' },
  { key: 'sewing', label: 'সেলাই' },
  { key: 'finishing', label: 'ফিনিশিং' },
  { key: 'quality', label: 'মান নিয়ন্ত্রণ' },
  { key: 'maintenance', label: 'রক্ষণাবেক্ষণ' },
  { key: 'hr', label: 'এইচআর' },
  { key: 'knitting', label: 'নিটিং' },
  { key: 'washing', label: 'ওয়াশিং' },
  { key: 'printing', label: 'প্রিন্ট ও এমব্রয়ডারি' },
]

export const DEFAULT_MACHINE_TYPES: Option[] = [
  { key: 'SNLS', label: 'সিঙ্গেল নিডল লকস্টিচ' },
  { key: 'DNLS', label: 'ডাবল নিডল লকস্টিচ' },
  { key: 'overlock', label: 'ওভারলক' },
  { key: 'flatlock', label: 'ফ্ল্যাটলক' },
  { key: 'bartack', label: 'বারট্যাক' },
  { key: 'buttonhole', label: 'বাটনহোল' },
  { key: 'button attach', label: 'বাটন অ্যাটাচ' },
  { key: 'feed of arm', label: 'ফিড অফ আর্ম' },
  { key: 'kansai', label: 'কানসাই' },
  { key: 'knitting', label: 'নিটিং মেশিন' },
  { key: 'linking', label: 'লিংকিং মেশিন' },
  { key: 'single needle', label: 'সিঙ্গেল নিডল' },
]

export const DEFAULT_DEFECTS: Defect[] = [
  { code: 'D01', label: 'সেলাই খোলা' },
  { code: 'D02', label: 'ফোঁড় বাদ পড়া' },
  { code: 'D03', label: 'সেলাই ছেঁড়া' },
  { code: 'D04', label: 'হেম অসমান' },
  { code: 'D05', label: 'তেলের দাগ' },
  { code: 'D06', label: 'রঙের তারতম্য' },
  { code: 'D07', label: 'মাপ ভুল' },
  { code: 'D08', label: 'কুঁচকানো' },
  { code: 'D09', label: 'লেবেল ভুল জায়গায়' },
  { code: 'D10', label: 'সুতা কাটা হয়নি' },
  { code: 'D11', label: 'কাপড়ে ফুটো' },
  { code: 'D12', label: 'ময়লা দাগ' },
  { code: 'D13', label: 'বোতাম বা চেইনের ত্রুটি' },
  { code: 'D14', label: 'প্রিন্ট বা এমব্রয়ডারির ত্রুটি' },
]

/** Milestones the system ticks off by itself when the matching work is recorded. */
export const AUTO_MILESTONES: Record<string, string> = {
  'master lc received': 'মাস্টার এলসি লেখা হলে',
  'btb lc opened': 'বিটুবি এলসি খোলা হলে',
  'fabric booking': 'কাপড় বুক হলে',
  'trims booking': 'ট্রিম বুক হলে',
  'pp meeting': 'পিপি স্বাক্ষর হলে',
  'bulk cutting start': 'প্রথম লে লেখা হলে',
  'sewing start': 'প্রথম ঘণ্টার আউটপুট লেখা হলে',
  'sewing complete': 'লট গৃহীত হলে',
  'final inspection': 'লট গৃহীত হলে',
  'ex-factory': 'বি/এল লেখা হলে',
  'documents to bank': 'বি/এল ব্যাংকে গেলে',
}

/** The original critical path, expressed as "N days before its anchor" so factories can reshape it. */
export const DEFAULT_TNA: Milestone[] = [
  { key: 'lab dip approval', label: 'ল্যাব ডিপ অনুমোদন', dept: 'merchandising', anchor: 'fabric booking', days: 3, span: 'none', categories: [] },
  { key: 'master lc received', label: 'মাস্টার এলসি প্রাপ্তি', dept: 'commercial', anchor: 'btb lc opened', days: 4, span: 'none', categories: [] },
  { key: 'btb lc opened', label: 'বিটুবি এলসি খোলা', dept: 'commercial', anchor: 'fabric booking', days: 2, span: 'none', categories: [] },
  { key: 'fabric booking', label: 'কাপড় বুকিং', dept: 'store', anchor: 'fabric in-house', days: 0, span: 'fabricLead', categories: [] },
  { key: 'trims booking', label: 'ট্রিমস বুকিং', dept: 'store', anchor: 'trims in-house', days: 15, span: 'none', categories: [] },
  { key: 'trims in-house', label: 'ট্রিমস কারখানায় পৌঁছানো', dept: 'store', anchor: 'pp meeting', days: 3, span: 'none', categories: [] },
  { key: 'fabric in-house', label: 'কাপড় কারখানায় পৌঁছানো', dept: 'store', anchor: 'bulk cutting start', days: 4, span: 'none', categories: [] },
  { key: 'fabric inspection', label: 'কাপড় পরিদর্শন (৪-পয়েন্ট)', dept: 'quality', anchor: 'bulk cutting start', days: 2, span: 'none', categories: [] },
  { key: 'wash standard approval', label: 'ওয়াশ স্ট্যান্ডার্ড অনুমোদন', dept: 'washing', anchor: 'pp sample approval', days: 3, span: 'none', categories: ['denim'] },
  { key: 'pp sample approval', label: 'পিপি স্যাম্পল অনুমোদন', dept: 'merchandising', anchor: 'pp meeting', days: 4, span: 'none', categories: [] },
  { key: 'pp meeting', label: 'পিপি মিটিং', dept: 'quality', anchor: 'bulk cutting start', days: 2, span: 'none', categories: [] },
  { key: 'bulk cutting start', label: 'বাল্ক কাটিং শুরু', dept: 'cutting', anchor: 'sewing start', days: 3, span: 'none', categories: [] },
  { key: 'sewing start', label: 'সেলাই শুরু', dept: 'sewing', anchor: 'sewing complete', days: 0, span: 'sewing', categories: [] },
  { key: 'sewing complete', label: 'সেলাই সম্পন্ন', dept: 'sewing', anchor: 'final inspection', days: 3, span: 'none', categories: [] },
  { key: 'final inspection', label: 'চূড়ান্ত পরিদর্শন', dept: 'quality', anchor: 'ex-factory', days: 2, span: 'none', categories: [] },
  { key: 'ex-factory', label: 'এক্স-ফ্যাক্টরি', dept: 'commercial', anchor: 'ship', days: 2, span: 'none', categories: [] },
  { key: 'documents to bank', label: 'কাগজপত্র ব্যাংকে জমা', dept: 'commercial', anchor: 'ship', days: -7, span: 'none', categories: [] },
]

export const DEFAULT_STAGES: Record<Stage, string> = {
  order: 'অর্ডার',
  materials: 'কাঁচামাল',
  cut: 'কাটিং',
  sew: 'সেলাই',
  qc: 'মান যাচাই',
  ship: 'শিপমেন্ট',
  paid: 'টাকা প্রাপ্তি',
}

/* ---------- schemas ---------- */

const keyText = z.string().trim().min(1).max(40)
const labelText = z.string().trim().min(1).max(80)
const num = (min: number, max: number, fallback: number) => z.number().min(min).max(max).catch(fallback)
const whole = (min: number, max: number, fallback: number) => z.number().int().min(min).max(max).catch(fallback)

export const optionSchema = z.object({ key: keyText, label: labelText })
export const categorySchema = z.object({
  key: keyText,
  label: labelText,
  unit: z.string().trim().min(1).max(12),
  sizes: z.array(z.string().trim().min(1).max(12)).min(1).max(24),
  ratio: z.array(z.number().int().min(0).max(100)).max(24),
})
export const defectSchema = z.object({ code: z.string().trim().min(1).max(12), label: labelText })
export const milestoneSchema = z.object({
  key: keyText,
  label: labelText,
  dept: keyText,
  anchor: keyText,
  days: z.number().int().min(-120).max(365),
  span: z.enum(['none', 'sewing', 'fabricLead']).catch('none'),
  categories: z.array(keyText).max(40).catch([]),
})

export const AQL_VALUES = [0.65, 1, 1.5, 2.5, 4, 6.5] as const
export type InspectionLevel = 'I' | 'II' | 'III'

export const productionSchema = z.object({
  perLineDay: whole(10, 20000, 900),
  fabricLeadDays: whole(1, 180, 25),
  efficiencyAlert: whole(30, 100, 85),
  shipBufferDays: whole(0, 60, 8),
  shiftStart: whole(0, 23, 8),
  hoursPerDay: whole(1, 24, 10),
})
export const qualitySchema = z.object({
  level: z.enum(['I', 'II', 'III']).catch('II'),
  aql: z
    .number()
    .refine((v) => (AQL_VALUES as readonly number[]).includes(v))
    .catch(2.5),
})
export const costingSchema = z.object({
  floorMargin: num(0, 90, 16),
  cmRate: num(0, 10000, 6.34),
  fabricRate: num(0, 1_000_000, 560),
  overhead: num(0, 1_000_000, 35),
  wastagePct: num(0, 50, 4),
})
export const commercialSchema = z.object({
  portLoading: z.string().trim().min(1).max(60).catch('Chattogram'),
  blTolerance: num(0, 20, 5),
  btbCap: num(10, 100, 75),
  tenorDays: whole(0, 360, 90),
  sourceTaxPct: num(0, 10, 1),
  centralFundPct: num(0, 1, 0.03),
  presentationDays: whole(1, 60, 21),
  realisationDays: whole(30, 360, 120),
})
export const gradeSchema = z.object({ grade: z.number().int().min(1).max(30), gross: z.number().min(0).max(10_000_000) })
/** Worker grades from the December 2023 minimum wage gazette for the garment sector. */
export const DEFAULT_GRADES = [
  { grade: 1, gross: 15035 },
  { grade: 2, gross: 14273 },
  { grade: 3, gross: 13550 },
  { grade: 4, gross: 12500 },
]
export const payrollSchema = z.object({
  grades: z.array(gradeSchema).min(1).max(30).catch(DEFAULT_GRADES),
  allowances: num(0, 1_000_000, 2450),
  basicDivisor: num(1, 4, 1.5),
  otMultiplier: num(1, 4, 2),
  otHoursBase: num(50, 400, 208),
  workingDays: whole(20, 31, 26),
  absenceDivisor: whole(1, 31, 30),
  attendanceBonus: num(0, 1_000_000, 450),
})
export const gatesSchema = z.object({
  costing: z.boolean().catch(true),
  btb: z.boolean().catch(true),
  pp: z.boolean().catch(true),
  bl: z.boolean().catch(true),
})
export const modulesSchema = z.object({
  inquiries: z.boolean().catch(true),
  costing: z.boolean().catch(true),
  commercial: z.boolean().catch(true),
  bond: z.boolean().catch(true),
  techpack: z.boolean().catch(true),
  maintenance: z.boolean().catch(true),
  payroll: z.boolean().catch(true),
})
const rule = (prefix: string, pad: number) =>
  z
    .object({
      prefix: z
        .string()
        .max(24)
        .regex(/^[A-Za-z0-9\-/_.{} ]*$/),
      pad: z.number().int().min(0).max(8),
    })
    .catch({ prefix, pad })
export const numberingSchema = z.object({
  inquiry: rule('INQ-', 0),
  quote: rule('QT-', 0),
  order: rule('PO-', 0),
  invoice: rule('INV-{YYYY}-', 4),
  employee: rule('OP-', 0),
})
export const stagesSchema = z.object(
  Object.fromEntries(STAGES.map((s) => [s, labelText.catch(DEFAULT_STAGES[s])])) as Record<Stage, z.ZodCatch<typeof labelText>>,
)

export type NumberingKey = keyof z.infer<typeof numberingSchema>

export type Config = {
  categories: Category[]
  departments: Option[]
  machineTypes: Option[]
  defects: Defect[]
  tna: Milestone[]
  stages: Record<Stage, string>
  production: z.infer<typeof productionSchema>
  quality: { level: InspectionLevel; aql: number }
  costing: z.infer<typeof costingSchema>
  commercial: z.infer<typeof commercialSchema>
  payroll: z.infer<typeof payrollSchema>
  gates: Record<Gate, boolean>
  modules: Record<ModuleKey, boolean>
  numbering: z.infer<typeof numberingSchema>
}

const listOf = <T extends z.ZodType>(item: T) => z.array(item).min(1).max(200)

/** Each section is stored as one row in `settings`; anything missing or invalid falls back to the default. */
export const SECTIONS = {
  categories: { schema: listOf(categorySchema), fallback: DEFAULT_CATEGORIES },
  departments: { schema: listOf(optionSchema), fallback: DEFAULT_DEPARTMENTS },
  machineTypes: { schema: listOf(optionSchema), fallback: DEFAULT_MACHINE_TYPES },
  defects: { schema: listOf(defectSchema), fallback: DEFAULT_DEFECTS },
  tna: { schema: listOf(milestoneSchema), fallback: DEFAULT_TNA },
  stages: { schema: stagesSchema, fallback: DEFAULT_STAGES },
  production: { schema: productionSchema, fallback: productionSchema.parse({}) },
  quality: { schema: qualitySchema, fallback: qualitySchema.parse({}) },
  costing: { schema: costingSchema, fallback: costingSchema.parse({}) },
  commercial: { schema: commercialSchema, fallback: commercialSchema.parse({}) },
  payroll: { schema: payrollSchema, fallback: payrollSchema.parse({}) },
  gates: { schema: gatesSchema, fallback: gatesSchema.parse({}) },
  modules: { schema: modulesSchema, fallback: modulesSchema.parse({}) },
  numbering: { schema: numberingSchema, fallback: numberingSchema.parse({}) },
} as const

export type SectionKey = keyof typeof SECTIONS

export function parseConfig(rows: { key: string; value: unknown }[]): Config {
  const stored = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as Record<SectionKey, unknown>
  for (const [key, { schema, fallback }] of Object.entries(SECTIONS) as [SectionKey, (typeof SECTIONS)[SectionKey]][]) {
    const raw = stored.get(key)
    const isList = Array.isArray(fallback)
    const parsed = raw === undefined ? null : schema.safeParse(raw)
    out[key] = parsed?.success ? parsed.data : isList ? fallback : schema.safeParse({}).data ?? fallback
  }
  const config = out as Config
  // Without LCs there is nothing for the BTB and B/L gates to check against.
  if (!config.modules.commercial) config.gates = { ...config.gates, btb: false, bl: false }
  return config
}

/** Anchors must exist and must not loop back on themselves. Returns a problem in Bangla, or null. */
export function tnaProblem(list: Milestone[]): string | null {
  const keys = new Set<string>()
  for (const m of list) {
    if (keys.has(m.key)) return `"${m.label}" দুবার আছে।`
    keys.add(m.key)
  }
  const byKey = new Map(list.map((m) => [m.key, m]))
  for (const m of list) {
    if (m.anchor !== 'ship' && !byKey.has(m.anchor)) return `"${m.label}"-এর ভিত্তি মাইলস্টোনটি তালিকায় নেই।`
    const seen = new Set([m.key])
    let cur = m
    while (cur.anchor !== 'ship') {
      if (seen.has(cur.anchor)) return `"${m.label}"-এর ভিত্তি ঘুরে আবার নিজের কাছেই ফিরে আসছে।`
      seen.add(cur.anchor)
      cur = byKey.get(cur.anchor)!
    }
  }
  return null
}

/* ---------- critical path ---------- */

export type PlanInputs = { lines: number; perLineDay: number; fabricLeadDays: number }

/**
 * Works the critical path backwards from the ship date. Each milestone lands a set number of days
 * before its anchor; sewing length follows quantity and line capacity, fabric booking follows the
 * supplier lead time. Dates are resolved over the whole template so category filters never break
 * an anchor chain.
 */
export function backSchedule(template: Milestone[], shipDate: string, quantity: number, p: PlanInputs, category?: string | null) {
  const sewingDays = Math.ceil(quantity / Math.max(1, p.lines * p.perLineDay)) + 2
  const byKey = new Map(template.map((m) => [m.key, m]))
  const due = new Map<string, string>()
  const resolve = (key: string, trail: string[]): string => {
    const cached = due.get(key)
    if (cached) return cached
    const m = byKey.get(key)!
    const chained = m.anchor !== 'ship' && byKey.has(m.anchor) && m.anchor !== key && !trail.includes(m.anchor)
    const base = chained ? resolve(m.anchor, [...trail, key]) : shipDate
    const extra = m.span === 'sewing' ? sewingDays : m.span === 'fabricLead' ? p.fabricLeadDays : 0
    const date = addDays(base, -(m.days + extra))
    due.set(key, date)
    return date
  }
  const rows = template
    .filter((m) => !m.categories.length || (category != null && m.categories.includes(category)))
    .map((m) => ({ key: m.key, label: m.label, dept: m.dept, due: resolve(m.key, []) }))
    .sort((a, b) => a.due.localeCompare(b.due))
    .map((m, i) => ({ ...m, sort: i }))
  const start = rows[0]?.due ?? shipDate
  return { rows, sewingDays, start, slack: daysBetween(today(), start) }
}

/* ---------- quality: ISO 2859-1 single sampling, normal inspection ---------- */

const LETTERS = 'ABCDEFGHJKLMNPQR'
const SAMPLE = [2, 3, 5, 8, 13, 20, 32, 50, 80, 125, 200, 315, 500, 800, 1250, 2000]
const ACCEPT = [1, 2, 3, 5, 7, 10, 14, 21]
const LOT_BANDS: [number, string, string, string][] = [
  [8, 'A', 'A', 'B'],
  [15, 'A', 'B', 'C'],
  [25, 'B', 'C', 'D'],
  [50, 'C', 'D', 'E'],
  [90, 'C', 'E', 'F'],
  [150, 'D', 'F', 'G'],
  [280, 'E', 'G', 'H'],
  [500, 'F', 'H', 'J'],
  [1200, 'G', 'J', 'K'],
  [3200, 'H', 'K', 'L'],
  [10000, 'J', 'L', 'M'],
  [35000, 'K', 'M', 'N'],
  [150000, 'L', 'N', 'P'],
  [500000, 'M', 'P', 'Q'],
  [Infinity, 'N', 'Q', 'R'],
]
/** Row of table 2-A where each AQL column first allows zero defects. */
const ZERO_ROW: Record<number, number> = { 6.5: 0, 4: 1, 2.5: 2, 1.5: 3, 1: 4, 0.65: 5 }

function cell(row: number, zero: number): number | 'up' | 'down' {
  if (row < zero) return 'down'
  if (row === zero) return 0
  if (row === zero + 1) return 'up'
  if (row === zero + 2) return 'down'
  const i = row - zero - 3
  return i < ACCEPT.length ? ACCEPT[i] : 'up'
}

/** Sample size and acceptance number, following the table's arrows to the first usable plan. */
export function aqlPlan(lotSize: number, level: InspectionLevel = 'II', aql = 2.5) {
  const band = LOT_BANDS.find(([max]) => lotSize <= max)!
  let row = LETTERS.indexOf(band[level === 'I' ? 1 : level === 'II' ? 2 : 3])
  const zero = ZERO_ROW[aql] ?? ZERO_ROW[2.5]
  for (let guard = 0; guard < LETTERS.length * 2; guard++) {
    const c = cell(row, zero)
    if (typeof c === 'number') {
      return { letter: LETTERS[row], sample: Math.min(SAMPLE[row], lotSize), accept: c, full: SAMPLE[row] >= lotSize }
    }
    row += c === 'down' ? 1 : -1
  }
  return { letter: 'N', sample: Math.min(500, lotSize), accept: 21, full: false }
}

/* ---------- payroll ---------- */

export function wage(p: Config['payroll'], grade: number, daysPresent: number, otHours: number) {
  const byGrade = [...p.grades].sort((a, b) => a.grade - b.grade)
  const gross = (byGrade.find((g) => g.grade === grade) ?? byGrade[byGrade.length - 1]).gross
  const basic = Math.max(0, (gross - p.allowances) / p.basicDivisor)
  const otRate = (basic / p.otHoursBase) * p.otMultiplier
  // Absence comes off basic pay only, one day's basic per day absent; allowances stay whole.
  const absentDays = Math.max(0, p.workingDays - daysPresent)
  const deduction = Math.min(gross, (basic / p.absenceDivisor) * absentDays)
  const earned = gross - deduction
  const bonus = daysPresent >= p.workingDays ? p.attendanceBonus : 0
  const ot = otRate * otHours
  return { gross, basic, otRate, deduction, earned, bonus, ot, net: earned + bonus + ot }
}

/** Wages fall due before the seventh working day after the month ends; Friday is the weekly holiday. */
export function wageDueDate(isoInMonth: string) {
  const [y, m] = isoInMonth.split('-').map(Number)
  let d = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  for (let left = 7; left > 0; ) {
    d = addDays(d, 1)
    if (new Date(`${d}T00:00:00Z`).getUTCDay() !== 5) left--
  }
  return d
}

/* ---------- dates ---------- */

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' })
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400000)
}

/** A short, URL-safe key for a new list entry, derived from its label when that is ASCII. */
export function makeKey(label: string, taken: Iterable<string>) {
  const used = new Set(taken)
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32)
  let key = ascii || `k${Date.now().toString(36)}`
  for (let i = 2; used.has(key); i++) key = `${ascii || 'k'}-${i}`
  return key
}
