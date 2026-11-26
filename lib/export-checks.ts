import type { Lc } from './db/schema'

export type CartonRow = {
  id: number
  cartonFrom: number
  cartonTo: number
  size: string
  pcsPerCarton: number
  netKg: number
  grossKg: number
  cbm: number
}

export function packingTotals(rows: CartonRow[]) {
  const bySize: Record<string, number> = {}
  let cartons = 0
  let pcs = 0
  let net = 0
  let gross = 0
  let cbm = 0
  for (const r of rows) {
    const count = r.cartonTo - r.cartonFrom + 1
    cartons += count
    pcs += count * r.pcsPerCarton
    bySize[r.size] = (bySize[r.size] ?? 0) + count * r.pcsPerCarton
    net += count * r.netKg
    gross += count * r.grossKg
    cbm += count * r.cbm
  }
  return { cartons, pcs, bySize, net, gross, cbm }
}

export function overlappingRange(rows: { cartonFrom: number; cartonTo: number }[], from: number, to: number) {
  return rows.find((r) => from <= r.cartonTo && to >= r.cartonFrom)
}

export type DocCheck = { label: string; ok: boolean; expected: string; found: string }

/** The invoice must agree with the LC, the packing list and the B/L before it leaves the factory. */
export function invoiceChecks(
  inv: { quantity: number; amount: number; description: string },
  lc: Lc | undefined,
  packedPcs: number,
  blQty: number | null,
): DocCheck[] {
  const out: DocCheck[] = []
  if (lc) {
    out.push({ label: 'এলসির মূল্যসীমা', ok: inv.amount <= lc.amount, expected: `≤ ${lc.amount}`, found: String(inv.amount) })
    if (lc.description)
      out.push({
        label: 'পণ্যের বিবরণ',
        ok: inv.description.trim().toLowerCase() === lc.description.trim().toLowerCase(),
        expected: lc.description,
        found: inv.description,
      })
  } else out.push({ label: 'মাস্টার এলসি', ok: false, expected: 'খোলা এলসি', found: 'নেই' })
  out.push({ label: 'প্যাকিং লিস্টের পরিমাণ', ok: inv.quantity === packedPcs, expected: String(packedPcs), found: String(inv.quantity) })
  if (blQty !== null) out.push({ label: 'বি/এল-এর পরিমাণ', ok: inv.quantity === blQty, expected: String(blQty), found: String(inv.quantity) })
  return out
}
