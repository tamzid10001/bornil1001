import {
  boolean,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

const ts = (name: string) => timestamp(name, { withTimezone: true })
const day = (name: string) => date(name, { mode: 'string' })

export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  dept: text('dept').notNull(),
})

export type ExtractedField = {
  key: string
  label: string
  value: string | null
  confidence: number
  source: string | null
}

export const inquiries = pgTable('inquiries', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  buyer: text('buyer').notNull(),
  fromEmail: text('from_email'),
  subject: text('subject'),
  body: text('body').notNull(),
  style: text('style'),
  fabric: text('fabric'),
  quantity: integer('quantity'),
  shipDate: day('ship_date'),
  targetPrice: doublePrecision('target_price'),
  fields: jsonb('fields').$type<ExtractedField[]>().notNull().default([]),
  status: text('status').notNull().default('draft'),
  confirmedBy: integer('confirmed_by'),
  confirmedAt: ts('confirmed_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const quotes = pgTable('quotes', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  inquiryId: integer('inquiry_id'),
  buyer: text('buyer').notNull(),
  style: text('style').notNull(),
  quantity: integer('quantity').notNull(),
  rev: integer('rev').notNull().default(1),
  fabricKg: doublePrecision('fabric_kg').notNull().default(0),
  fabricRate: doublePrecision('fabric_rate').notNull().default(0),
  cmMinutes: doublePrecision('cm_minutes').notNull().default(0),
  cmRate: doublePrecision('cm_rate').notNull().default(0),
  trims: doublePrecision('trims').notNull().default(0),
  overhead: doublePrecision('overhead').notNull().default(0),
  fob: doublePrecision('fob').notNull().default(0),
  floorMargin: doublePrecision('floor_margin').notNull().default(16),
  status: text('status').notNull().default('draft'),
  releasedBy: integer('released_by'),
  releasedAt: ts('released_at'),
  sentAt: ts('sent_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  quoteId: integer('quote_id'),
  buyer: text('buyer').notNull(),
  style: text('style').notNull(),
  fabric: text('fabric'),
  quantity: integer('quantity').notNull(),
  sizes: jsonb('sizes').$type<Record<string, number>>().notNull().default({}),
  shipDate: day('ship_date').notNull(),
  fob: doublePrecision('fob').notNull(),
  stage: text('stage').notNull().default('order'),
  tnaCommitted: boolean('tna_committed').notNull().default(false),
  ppSignedBy: integer('pp_signed_by'),
  ppSignedAt: ts('pp_signed_at'),
  realisedAmount: doublePrecision('realised_amount'),
  btbSettled: doublePrecision('btb_settled'),
  airFreight: doublePrecision('air_freight'),
  discount: doublePrecision('discount'),
  realisedAt: day('realised_at'),
  closedAt: ts('closed_at'),
  planLines: integer('plan_lines').notNull().default(4),
  planPerLineDay: integer('plan_per_line_day').notNull().default(900),
  planFabricLeadDays: integer('plan_fabric_lead_days').notNull().default(25),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const lcAmendments = pgTable('lc_amendments', {
  id: serial('id').primaryKey(),
  lcId: integer('lc_id').notNull(),
  orderId: integer('order_id').notNull(),
  no: integer('no').notNull(),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value').notNull(),
  reason: text('reason').notNull(),
  createdBy: integer('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const bondLedger = pgTable('bond_ledger', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  udId: integer('ud_id').notNull(),
  kind: text('kind').notNull(),
  material: text('material').notNull(),
  qtyKg: doublePrecision('qty_kg').notNull(),
  ref: text('ref').notNull(),
  on: day('on_date').notNull(),
  createdBy: integer('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const cartons = pgTable('cartons', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  cartonFrom: integer('carton_from').notNull(),
  cartonTo: integer('carton_to').notNull(),
  size: text('size').notNull(),
  pcsPerCarton: integer('pcs_per_carton').notNull(),
  netKg: doublePrecision('net_kg').notNull(),
  grossKg: doublePrecision('gross_kg').notNull(),
  cbm: doublePrecision('cbm').notNull(),
  createdBy: integer('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export type TechPackData = {
  fields: ExtractedField[]
  measurements: { point: string; sizes: Record<string, string>; tolerance: string | null }[]
  trims: { item: string; qtyPerPc: number | null; note: string | null }[]
  operations: { name: string; smv: number | null }[]
}

export const techPacks = pgTable('tech_packs', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  body: text('body').notNull(),
  data: jsonb('data').$type<TechPackData>().notNull(),
  reader: text('reader').notNull().default('ai'),
  trimsAdded: boolean('trims_added').notNull().default(false),
  createdBy: integer('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  number: text('number').notNull(),
  issuedOn: day('issued_on').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: doublePrecision('unit_price').notNull(),
  amount: doublePrecision('amount').notNull(),
  description: text('description').notNull(),
  exp: text('exp'),
  status: text('status').notNull().default('draft'),
  createdBy: integer('created_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const tna = pgTable('tna', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  name: text('name').notNull(),
  ownerDept: text('owner_dept').notNull(),
  dueDate: day('due_date').notNull(),
  doneAt: day('done_at'),
  sort: integer('sort').notNull().default(0),
})

export const lcs = pgTable('lcs', {
  id: serial('id').primaryKey(),
  kind: text('kind').notNull(),
  number: text('number').notNull(),
  orderId: integer('order_id'),
  masterId: integer('master_id'),
  amount: doublePrecision('amount').notNull(),
  tenorDays: integer('tenor_days').notNull().default(0),
  bank: text('bank'),
  status: text('status').notNull().default('requested'),
  openedAt: day('opened_at'),
  latestShipment: day('latest_shipment'),
  portLoading: text('port_loading'),
  portDischarge: text('port_discharge'),
  description: text('description'),
  quantity: integer('quantity'),
  maturity: day('maturity'),
  settledAmount: doublePrecision('settled_amount'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const ud = pgTable('ud', {
  id: serial('id').primaryKey(),
  number: text('number').notNull(),
  orderId: integer('order_id').notNull(),
  yarnPermittedKg: doublePrecision('yarn_permitted_kg').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const bom = pgTable('bom', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  material: text('material').notNull(),
  qty: doublePrecision('qty').notNull(),
  unit: text('unit').notNull(),
  rate: doublePrecision('rate').notNull().default(0),
  supplier: text('supplier'),
  source: text('source').notNull().default('import'),
  status: text('status').notNull().default('pending'),
  btbId: integer('btb_id'),
  bookedBy: integer('booked_by'),
  bookedAt: ts('booked_at'),
})

export const lays = pgTable('lays', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  layNo: integer('lay_no').notNull(),
  plies: integer('plies').notNull(),
  markerEff: doublePrecision('marker_eff').notNull(),
  ratio: jsonb('ratio').$type<Record<string, number>>().notNull().default({}),
  status: text('status').notNull().default('running'),
  bundleFrom: integer('bundle_from').notNull(),
  bundleTo: integer('bundle_to').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const sewing = pgTable('sewing', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  line: integer('line').notNull(),
  hourAt: ts('hour_at').notNull(),
  target: integer('target').notNull(),
  actual: integer('actual').notNull(),
  downtimeMin: integer('downtime_min').notNull().default(0),
  note: text('note'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const defects = pgTable('defects', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  line: integer('line').notNull(),
  code: text('code').notNull(),
  label: text('label').notNull(),
  count: integer('count').notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const lots = pgTable('lots', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  lotSize: integer('lot_size').notNull(),
  aql: doublePrecision('aql').notNull(),
  sample: integer('sample').notNull(),
  major: integer('major').notNull(),
  acceptMax: integer('accept_max').notNull(),
  result: text('result').notNull(),
  decidedBy: integer('decided_by'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const bl = pgTable('bl', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  lcId: integer('lc_id'),
  portLoading: text('port_loading').notNull(),
  portDischarge: text('port_discharge').notNull(),
  quantity: integer('quantity').notNull(),
  description: text('description').notNull(),
  onBoard: day('on_board').notNull(),
  status: text('status').notNull().default('draft'),
  releasedBy: integer('released_by'),
  releasedAt: ts('released_at'),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const machines = pgTable('machines', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  line: integer('line').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('running'),
})

export const tickets = pgTable('tickets', {
  id: serial('id').primaryKey(),
  machineId: integer('machine_id').notNull(),
  issue: text('issue').notNull(),
  mechanic: text('mechanic'),
  openedAt: ts('opened_at').notNull().defaultNow(),
  closedAt: ts('closed_at'),
  downtimeMin: integer('downtime_min'),
})

export const employees = pgTable('employees', {
  id: serial('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  grade: integer('grade').notNull(),
  section: text('section').notNull(),
  line: integer('line'),
  daysPresent: integer('days_present').notNull().default(26),
  otHours: doublePrecision('ot_hours').notNull().default(0),
})

export const audit = pgTable('audit', {
  id: serial('id').primaryKey(),
  at: ts('at').notNull().defaultNow(),
  actorId: integer('actor_id'),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: integer('entity_id'),
  detail: text('detail'),
})

export type Order = typeof orders.$inferSelect
export type Quote = typeof quotes.$inferSelect
export type Person = typeof people.$inferSelect
export type Lc = typeof lcs.$inferSelect
export type LcAmendment = typeof lcAmendments.$inferSelect
export type BondEntry = typeof bondLedger.$inferSelect
export type Carton = typeof cartons.$inferSelect
export type Invoice = typeof invoices.$inferSelect
export type TechPack = typeof techPacks.$inferSelect
