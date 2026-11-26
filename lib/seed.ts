import 'server-only'
import { db } from './db'
import {
  audit,
  bl,
  bom,
  defects,
  employees,
  inquiries,
  lays,
  lcs,
  lots,
  machines,
  orders,
  people,
  quotes,
  sewing,
  tickets,
  tna,
  ud,
} from './db/schema'
import { addDays, DEFECT_CODES, TNA_TEMPLATE, today } from './domain'

const INQUIRY_BODY = `Hi team,

Please quote for SS26 piqué polo, style NH-PQ-220.
Fabric: 220gsm cotton piqué, 2x1 rib collar and cuffs.
Quantity: 36,000 pcs, ratio S1 M3 L3 XL2 XXL1.
Ship window: 12 Nov 2026, FOB Chattogram.
Target price around BDT 585 / pc.
Tech pack and BOM attached.

Best,
Ingrid Sørensen
Sourcing, Nordhavn Apparel`

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000)
}

export async function seedExampleFactory() {
  const existing = await db.select({ id: people.id }).from(people).limit(1)
  if (existing.length) return

  const t = today()

  const staff = await db
    .insert(people)
    .values([
      { name: 'Rahima Akter', role: 'owner', dept: 'management' },
      { name: 'Tanvir Hasan', role: 'merchandiser', dept: 'merchandising' },
      { name: 'Nusrat Jahan', role: 'planner', dept: 'planning' },
      { name: 'Kamal Uddin', role: 'store', dept: 'store' },
      { name: 'Shahidul Islam', role: 'cutting', dept: 'cutting' },
      { name: 'Mitu Begum', role: 'sewing', dept: 'sewing' },
      { name: 'Farhana Rahman', role: 'qa', dept: 'quality' },
      { name: 'Arif Chowdhury', role: 'commercial', dept: 'commercial' },
      { name: 'Jasim Mia', role: 'mechanic', dept: 'maintenance' },
      { name: 'Sultana Parvin', role: 'hr', dept: 'hr' },
    ])
    .returning()
  const by = (role: string) => staff.find((p) => p.role === role)!.id

  const [inq] = await db
    .insert(inquiries)
    .values([
      {
        code: 'INQ-8841',
        buyer: 'Nordhavn Apparel',
        fromEmail: 'sourcing@nordhavn.example',
        subject: 'SS26 piqué polo — price request',
        body: INQUIRY_BODY,
        style: 'NH-PQ-220 piqué polo',
        fabric: '220gsm cotton piqué',
        quantity: 36000,
        shipDate: '2026-11-12',
        targetPrice: 585.6,
        status: 'confirmed',
        confirmedBy: by('merchandiser'),
        confirmedAt: hoursAgo(24 * 70),
        fields: [
          { key: 'style', label: 'style', value: 'NH-PQ-220 piqué polo', confidence: 0.97, source: 'Please quote for SS26 piqué polo, style NH-PQ-220.' },
          { key: 'fabric', label: 'fabric', value: '220gsm cotton piqué', confidence: 0.96, source: 'Fabric: 220gsm cotton piqué' },
          { key: 'quantity', label: 'quantity', value: '36000', confidence: 0.99, source: 'Quantity: 36,000 pcs' },
          { key: 'ship_date', label: 'ship window', value: '2026-11-12', confidence: 0.88, source: 'Ship window: 12 Nov 2026' },
          { key: 'target_price', label: 'target price', value: '585', confidence: 0.93, source: 'Target price around BDT 585 / pc.' },
          { key: 'wash_care', label: 'wash care', value: null, confidence: 0, source: null },
        ],
      },
      {
        code: 'INQ-8862',
        buyer: 'Halden Workwear',
        fromEmail: 'buying@halden.example',
        subject: 'AW27 twill chino — RFQ',
        body: 'Hello,\n\nRequesting FOB for a stretch twill chino, 98/2 cotton elastane, 280gsm.\nQty 18,000 units across 28-38 waist.\nDelivery end of January 2027.\nTarget BDT 903 / pc.\n\nRegards,\nMarkus Lind',
        status: 'draft',
        fields: [],
      },
    ])
    .returning()

  const qs = await db
    .insert(quotes)
    .values([
      { code: 'QT-3172', inquiryId: inq.id, buyer: 'Nordhavn Apparel', style: 'NH-PQ-220 piqué polo', quantity: 36000, rev: 2, fabricKg: 0.25, fabricRate: 561.2, cmMinutes: 18.4, cmRate: 6.34, trims: 58.56, overhead: 39.04, fob: 592.92, status: 'confirmed', releasedBy: by('owner'), releasedAt: hoursAgo(24 * 66), sentAt: hoursAgo(24 * 66) },
      { code: 'QT-3190', buyer: 'Aster Retail', style: 'AS-JT-160 jersey tee', quantity: 24000, rev: 3, fabricKg: 0.19, fabricRate: 512.4, cmMinutes: 11.2, cmRate: 6.34, trims: 37.82, overhead: 32.94, fob: 283.04, status: 'held' },
      { code: 'QT-3201', buyer: 'Halden Workwear', style: 'HW-TC-280 twill chino', quantity: 18000, rev: 1, fabricKg: 0.62, fabricRate: 622.2, cmMinutes: 27, cmRate: 6.34, trims: 90.28, overhead: 54.9, fob: 896.7, status: 'confirmed', releasedBy: by('owner'), releasedAt: hoursAgo(24 * 20), sentAt: hoursAgo(24 * 20) },
    ])
    .returning()

  const os = await db
    .insert(orders)
    .values([
      { code: 'PO-2044', quoteId: qs[0].id, buyer: 'Nordhavn Apparel', style: 'NH-PQ-220 piqué polo', fabric: '220gsm cotton piqué', quantity: 36000, sizes: { S: 3600, M: 10800, L: 10800, XL: 7200, XXL: 3600 }, shipDate: addDays(t, 24), fob: 592.92, stage: 'sew', tnaCommitted: true, ppSignedBy: by('qa'), ppSignedAt: hoursAgo(24 * 9) },
      { code: 'PO-2051', quoteId: qs[2].id, buyer: 'Halden Workwear', style: 'HW-TC-280 twill chino', fabric: '280gsm stretch twill', quantity: 18000, sizes: { '30': 3600, '32': 5400, '34': 5400, '36': 3600 }, shipDate: addDays(t, 64), fob: 896.7, stage: 'materials', tnaCommitted: true },
      { code: 'PO-2039', buyer: 'Aster Retail', style: 'AS-JT-150 jersey tee', fabric: '150gsm combed jersey', quantity: 48000, sizes: { S: 9600, M: 14400, L: 14400, XL: 9600 }, shipDate: addDays(t, 3), fob: 294.02, stage: 'ship', tnaCommitted: true, ppSignedBy: by('qa'), ppSignedAt: hoursAgo(24 * 45) },
      { code: 'PO-2027', buyer: 'Nordhavn Apparel', style: 'NH-SW-300 crew sweatshirt', fabric: '300gsm fleece', quantity: 22000, sizes: { S: 4400, M: 6600, L: 6600, XL: 4400 }, shipDate: addDays(t, -38), fob: 841.8, stage: 'paid', tnaCommitted: true, ppSignedBy: by('qa'), ppSignedAt: hoursAgo(24 * 90), realisedAmount: 18358560, btbSettled: 10516400, airFreight: 0, discount: 161040, realisedAt: addDays(t, -6), closedAt: hoursAgo(24 * 5) },
    ])
    .returning()
  const [o2044, o2051, o2039, o2027] = os

  const tnaRows = os.flatMap((o) =>
    TNA_TEMPLATE.map((m, i) => {
      const due = addDays(o.shipDate, -m.offset)
      const done = due < t && !(o.id === o2051.id && m.name === 'btb lc opened')
      return { orderId: o.id, name: m.name, ownerDept: m.dept, dueDate: due, doneAt: done ? due : null, sort: i }
    }),
  )
  await db.insert(tna).values(tnaRows)

  const masters = await db
    .insert(lcs)
    .values([
      { kind: 'master', number: 'LC-0612', orderId: o2044.id, amount: 21345120, bank: 'Eastern Bank', status: 'opened', openedAt: addDays(t, -50), latestShipment: addDays(t, 28), portLoading: 'Chattogram', portDischarge: 'Aarhus', description: 'cotton piqué polo shirts', quantity: 36000 },
      { kind: 'master', number: 'LC-0655', orderId: o2051.id, amount: 16140600, bank: 'City Bank', status: 'opened', openedAt: addDays(t, -10), latestShipment: addDays(t, 68), portLoading: 'Chattogram', portDischarge: 'Gothenburg', description: 'stretch twill trousers', quantity: 18000 },
      { kind: 'master', number: 'LC-0598', orderId: o2039.id, amount: 14112960, bank: 'Eastern Bank', status: 'opened', openedAt: addDays(t, -80), latestShipment: addDays(t, 6), portLoading: 'Chattogram', portDischarge: 'Bremerhaven', description: 'cotton jersey t-shirts', quantity: 48000 },
      { kind: 'master', number: 'LC-0544', orderId: o2027.id, amount: 18519600, bank: 'City Bank', status: 'opened', openedAt: addDays(t, -130), latestShipment: addDays(t, -35), portLoading: 'Chattogram', portDischarge: 'Aarhus', description: 'fleece sweatshirts', quantity: 22000 },
    ])
    .returning()

  const btbs = await db
    .insert(lcs)
    .values([
      { kind: 'btb', number: 'BTB-1188', orderId: o2044.id, masterId: masters[0].id, amount: 5303340, tenorDays: 120, bank: 'Eastern Bank', status: 'opened', openedAt: addDays(t, -46), maturity: addDays(t, 74), description: 'piqué fabric — Square Textiles' },
      { kind: 'btb', number: 'BTB-1204', orderId: o2051.id, masterId: masters[1].id, amount: 7310240, tenorDays: 120, bank: 'City Bank', status: 'requested', description: 'stretch twill — Envoy Textiles' },
      { kind: 'btb', number: 'BTB-1151', orderId: o2039.id, masterId: masters[2].id, amount: 4908060, tenorDays: 90, bank: 'Eastern Bank', status: 'opened', openedAt: addDays(t, -76), maturity: addDays(t, 14), description: 'jersey fabric — Mondol Fabrics' },
      { kind: 'btb', number: 'BTB-1097', orderId: o2027.id, masterId: masters[3].id, amount: 10516400, tenorDays: 120, bank: 'City Bank', status: 'opened', openedAt: addDays(t, -126), maturity: addDays(t, -6), settledAmount: 10516400, description: 'fleece fabric — Akij Textiles' },
    ])
    .returning()

  await db.insert(ud).values([
    { number: 'UD-BGMEA-44712', orderId: o2044.id, yarnPermittedKg: 9500 },
    { number: 'UD-BGMEA-45021', orderId: o2051.id, yarnPermittedKg: 11800 },
    { number: 'UD-BGMEA-43980', orderId: o2039.id, yarnPermittedKg: 9600 },
  ])

  await db.insert(bom).values([
    { orderId: o2044.id, material: '220gsm cotton piqué', qty: 9450, unit: 'kg', rate: 561.2, supplier: 'Square Textiles', source: 'import', status: 'booked', btbId: btbs[0].id, bookedBy: by('store'), bookedAt: hoursAgo(24 * 45) },
    { orderId: o2044.id, material: '2x1 rib collar & cuff', qty: 37800, unit: 'set', rate: 10.98, supplier: 'Padma Knit', source: 'local', status: 'booked', bookedBy: by('store'), bookedAt: hoursAgo(24 * 44) },
    { orderId: o2044.id, material: 'buttons 18L, 3 per pc', qty: 113400, unit: 'pc', rate: 0.73, supplier: 'YKK Bangladesh', source: 'local', status: 'booked', bookedBy: by('store'), bookedAt: hoursAgo(24 * 44) },
    { orderId: o2044.id, material: 'polybag + carton', qty: 36000, unit: 'pc', rate: 8.54, supplier: 'Dhaka Pack', source: 'local', status: 'booked', bookedBy: by('store'), bookedAt: hoursAgo(24 * 40) },
    { orderId: o2051.id, material: '280gsm stretch twill', qty: 11750, unit: 'kg', rate: 622.2, supplier: 'Envoy Textiles', source: 'import', status: 'pending', btbId: btbs[1].id },
    { orderId: o2051.id, material: 'metal shank button + rivets', qty: 18900, unit: 'set', rate: 14.64, supplier: 'YKK Bangladesh', source: 'local', status: 'booked', bookedBy: by('store'), bookedAt: hoursAgo(24 * 5) },
    { orderId: o2051.id, material: 'zipper #4 brass', qty: 18900, unit: 'pc', rate: 17.08, supplier: 'YKK Bangladesh', source: 'local', status: 'pending' },
    { orderId: o2039.id, material: '150gsm combed jersey', qty: 9580, unit: 'kg', rate: 512.4, supplier: 'Mondol Fabrics', source: 'import', status: 'booked', btbId: btbs[2].id, bookedBy: by('store'), bookedAt: hoursAgo(24 * 74) },
  ])

  await db.insert(lays).values([
    { orderId: o2044.id, layNo: 1, plies: 80, markerEff: 84.2, ratio: { S: 1, M: 3, L: 3, XL: 2, XXL: 1 }, status: 'closed', bundleFrom: 1, bundleTo: 40 },
    { orderId: o2044.id, layNo: 2, plies: 80, markerEff: 85.1, ratio: { S: 1, M: 3, L: 3, XL: 2, XXL: 1 }, status: 'closed', bundleFrom: 41, bundleTo: 80 },
    { orderId: o2044.id, layNo: 3, plies: 76, markerEff: 83.6, ratio: { S: 1, M: 3, L: 3, XL: 2, XXL: 1 }, status: 'running', bundleFrom: 81, bundleTo: 118 },
  ])

  // Hourly sewing output: four lines on PO-2044, previous 3 days plus today's shift so far.
  const nowHourDhaka = (new Date().getUTCHours() + 6) % 24
  const todayHours = Math.max(0, Math.min(10, nowHourDhaka - 8))
  const sewingRows: (typeof sewing.$inferInsert)[] = []
  const lineBase: Record<number, number> = { 1: 0.94, 2: 0.88, 3: 0.97, 4: 0.79 }
  for (let d = 3; d >= 0; d--) {
    const hours = d === 0 ? todayHours : 10
    for (let h = 0; h < hours; h++) {
      for (const line of [1, 2, 3, 4]) {
        const target = 120
        const wobble = ((line * 7 + h * 13 + d * 5) % 11) / 100 - 0.05
        const down = line === 4 && d === 0 && h === 2 ? 25 : 0
        const actual = Math.round(target * (lineBase[line] + wobble) * (down ? 0.6 : 1))
        const at = new Date()
        at.setUTCDate(at.getUTCDate() - d)
        at.setUTCHours(8 - 6 + h, 0, 0, 0)
        sewingRows.push({ orderId: o2044.id, line, hourAt: at, target, actual, downtimeMin: down, note: down ? 'overlock M4-03 down' : null })
      }
    }
  }
  if (sewingRows.length) await db.insert(sewing).values(sewingRows)

  const defectRows = [
    [1, 'D01', 14], [1, 'D02', 9], [2, 'D01', 22], [2, 'D05', 6], [2, 'D07', 11],
    [3, 'D02', 5], [3, 'D04', 7], [4, 'D01', 18], [4, 'D08', 15], [4, 'D03', 9],
  ] as const
  await db.insert(defects).values(
    defectRows.map(([line, code, count]) => ({
      orderId: o2044.id,
      line,
      code,
      label: DEFECT_CODES.find((d) => d.code === code)!.label,
      count,
    })),
  )

  await db.insert(lots).values([
    { orderId: o2039.id, lotSize: 48000, aql: 2.5, sample: 500, major: 9, acceptMax: 21, result: 'accepted', decidedBy: by('qa'), createdAt: hoursAgo(30) },
    { orderId: o2027.id, lotSize: 22000, aql: 2.5, sample: 315, major: 6, acceptMax: 14, result: 'accepted', decidedBy: by('qa'), createdAt: hoursAgo(24 * 42) },
  ])

  await db.insert(bl).values([
    { orderId: o2039.id, lcId: masters[2].id, portLoading: 'Chattogram', portDischarge: 'Hamburg', quantity: 48000, description: 'cotton jersey t-shirts', onBoard: addDays(t, 2), status: 'draft' },
    { orderId: o2027.id, lcId: masters[3].id, portLoading: 'Chattogram', portDischarge: 'Aarhus', quantity: 22000, description: 'fleece sweatshirts', onBoard: addDays(t, -38), status: 'released', releasedBy: by('commercial'), releasedAt: hoursAgo(24 * 38) },
  ])

  const machineRows = [1, 2, 3, 4].flatMap((line) =>
    ['SNLS', 'SNLS', 'overlock', 'overlock', 'flatlock', 'bartack'].map((kind, i) => ({
      code: `M${line}-${String(i + 1).padStart(2, '0')}`,
      line,
      kind,
      status: line === 4 && i === 2 ? 'down' : 'running',
    })),
  )
  const ms = await db.insert(machines).values(machineRows).returning()
  const downMachine = ms.find((m) => m.status === 'down')!
  await db.insert(tickets).values([
    { machineId: downMachine.id, issue: 'looper timing slipped, skipping stitches', mechanic: 'Jasim Mia', openedAt: hoursAgo(1.5) },
    { machineId: ms[1].id, issue: 'needle bar oil leak', mechanic: 'Jasim Mia', openedAt: hoursAgo(28), closedAt: hoursAgo(27), downtimeMin: 55 },
  ])

  const names = ['Shirin Akter', 'Rokeya Begum', 'Mousumi Khatun', 'Parvin Sultana', 'Jesmin Nahar', 'Halima Khatun', 'Rina Das', 'Laboni Akter', 'Selina Parvin', 'Asma Begum', 'Morjina Khatun', 'Taslima Akter', 'Nasrin Sultana', 'Ruma Akter', 'Sabina Yasmin', 'Kulsum Begum']
  await db.insert(employees).values(
    names.map((name, i) => ({
      code: `OP-${String(1001 + i)}`,
      name,
      grade: [3, 4, 4, 5, 3, 4, 2, 5, 4, 3, 5, 4, 3, 4, 5, 2][i],
      section: 'sewing',
      line: (i % 4) + 1,
      daysPresent: [26, 26, 25, 26, 24, 26, 26, 23, 26, 26, 25, 26, 26, 22, 26, 26][i],
      otHours: [42, 38, 30, 44, 20, 36, 40, 18, 46, 34, 28, 40, 39, 12, 44, 41][i],
    })),
  )

  await db.insert(audit).values([
    { actorId: by('owner'), actor: 'Rahima Akter · owner', action: 'released costing gate', entity: 'quote', entityId: qs[0].id, detail: 'QT-3172 rev 2 · margin 18.9%' },
    { actorId: by('qa'), actor: 'Farhana Rahman · qa', action: 'signed pp meeting', entity: 'order', entityId: o2044.id, detail: 'PO-2044 · pp sample approved' },
    { actorId: by('commercial'), actor: 'Arif Chowdhury · commercial', action: 'released b/l', entity: 'order', entityId: o2027.id, detail: 'PO-2027 · all 5 checks matched LC-0544' },
    { actorId: by('owner'), actor: 'Rahima Akter · owner', action: 'closed order', entity: 'order', entityId: o2027.id, detail: 'PO-2027 · realised $150,480' },
  ])
}
