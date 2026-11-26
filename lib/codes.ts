import 'server-only'
import { pool } from './db'
import { today, type Config, type NumberingKey } from './config'

/** Where each document number lives, and the floor a fresh counter starts above. */
const SOURCES: Record<NumberingKey, { table: string; column: string; floor: number }> = {
  inquiry: { table: 'inquiries', column: 'code', floor: 300 },
  quote: { table: 'quotes', column: 'code', floor: 1100 },
  order: { table: 'orders', column: 'code', floor: 2040 },
  invoice: { table: 'invoices', column: 'number', floor: 0 },
  employee: { table: 'employees', column: 'code', floor: 1000 },
}

/**
 * Next document number from a row-locked counter, so two people saving at once never get the
 * same code. A new counter starts after the highest number already in use.
 */
export async function nextCode(key: NumberingKey, numbering: Config['numbering']) {
  const s = SOURCES[key]
  const { rows } = await pool.query<{ value: number }>(
    `insert into counters (key, value)
     select $1, greatest(coalesce(max(substring(${s.column} from '(\\d{1,9})\\D*$')::int), 0), $2) + 1 from ${s.table}
     on conflict (key) do update set value = counters.value + 1
     returning value`,
    [key, s.floor],
  )
  const rule = numbering[key]
  const year = today().slice(0, 4)
  const prefix = rule.prefix.replaceAll('{YYYY}', year).replaceAll('{YY}', year.slice(2))
  return `${prefix}${String(rows[0].value).padStart(rule.pad, '0')}`
}
