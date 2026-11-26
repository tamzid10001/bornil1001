'use client'

import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'

type Opt = { value: string; label: string }
type Value = string | number | string[] | number[]
type Row = Record<string, Value> & { __id: string }

export type Field = {
  key: string
  label: string
  kind: 'text' | 'number' | 'select' | 'csv' | 'csv-number' | 'checks'
  width: string
  placeholder?: string
  step?: string
  min?: number
  max?: number
  options?: Opt[]
  /** Use the other rows as options (e.g. a milestone's anchor), after any fixed options. */
  rowOptions?: { value: string; label: string }
  /** The row's identity: hidden and generated for new rows, or shown and locked once saved. */
  identity?: 'hidden' | 'locked'
}

let seq = 0
const freshId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`

/** Wide editors stay as stacked cards until there is room for every column. */
const LAYOUT = {
  md: {
    header: 'hidden gap-2 px-1 md:grid',
    row: 'md:grid-cols-[var(--cols)] md:items-start md:border-0 md:p-0',
    label: 'label md:sr-only',
    span: 'col-span-2 md:col-span-1',
  },
  xl: {
    header: 'hidden gap-2 px-1 xl:grid',
    row: 'xl:grid-cols-[var(--cols)] xl:items-start xl:border-0 xl:p-0',
    label: 'label xl:sr-only',
    span: 'col-span-2 xl:col-span-1',
  },
}

function toRow(r: Record<string, Value>): Row {
  return { ...r, __id: freshId() }
}

function display(f: Field, v: Value | undefined) {
  if (f.kind === 'csv' || f.kind === 'csv-number') return Array.isArray(v) ? v.join(', ') : ''
  return v ?? ''
}

function parse(f: Field, raw: string): Value {
  if (f.kind === 'number') return raw === '' ? '' : Number(raw)
  if (f.kind === 'csv')
    return raw
      .split(/[,،]/)
      .map((s) => s.trim())
      .filter(Boolean)
  if (f.kind === 'csv-number')
    return raw
      .split(/[,،]/)
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n))
  return raw
}

/**
 * Edits a list of settings rows in place and submits them as one JSON field. Rows can be added,
 * removed and reordered; identity keys stay stable so saved references never break.
 */
export function ListEditor({
  name = 'payload',
  fields,
  initial,
  blank,
  addLabel,
  minRows = 1,
  stackBelow = 'md',
}: {
  name?: string
  fields: Field[]
  initial: Record<string, Value>[]
  blank: Record<string, Value>
  addLabel: string
  minRows?: number
  stackBelow?: keyof typeof LAYOUT
}) {
  const ui = LAYOUT[stackBelow]
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow))
  const saved = useRef(new Set(initial.map((r) => String(r[fields.find((f) => f.identity)?.key ?? ''] ?? ''))))
  const identity = fields.find((f) => f.identity)
  const template = fields
    .filter((f) => f.identity !== 'hidden')
    .map((f) => f.width)
    .concat('6.5rem')
    .join(' ')

  const json = useMemo(
    () =>
      JSON.stringify(
        rows.map(({ __id, ...r }) => {
          void __id
          return r
        }),
      ),
    [rows],
  )

  const update = (id: string, key: string, value: Value) => setRows((rs) => rs.map((r) => (r.__id === id ? { ...r, [key]: value } : r)))
  const move = (i: number, by: number) =>
    setRows((rs) => {
      const next = [...rs]
      const [r] = next.splice(i, 1)
      next.splice(i + by, 0, r)
      return next
    })
  const add = () => {
    const row = toRow({ ...blank })
    if (identity?.identity === 'hidden') row[identity.key] = `m${freshId()}`
    else if (identity && !row[identity.key]) row[identity.key] = `x${Date.now().toString(36).slice(-5)}`
    setRows((rs) => [...rs, row])
  }

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={json} />
      <div className={ui.header} style={{ gridTemplateColumns: template }} aria-hidden="true">
        {fields
          .filter((f) => f.identity !== 'hidden')
          .map((f) => (
            <span key={f.key} className="label">
              {f.label}
            </span>
          ))}
        <span />
      </div>
      <ol className="flex flex-col gap-2">
        {rows.map((row, i) => {
          const isSaved = identity ? saved.current.has(String(row[identity.key] ?? '')) : false
          return (
            <li
              key={row.__id}
              className={`grid grid-cols-2 gap-2 rounded-lg border border-rule p-3 ${ui.row}`}
              style={{ ['--cols' as string]: template }}
            >
              {fields
                .filter((f) => f.identity !== 'hidden')
                .map((f) => {
                  const aria = `${f.label} — সারি ${i + 1}`
                  const value = row[f.key]
                  return (
                    <label key={f.key} className={`flex min-w-0 flex-col gap-1 ${f.kind === 'text' || f.kind === 'csv' || f.kind === 'checks' ? ui.span : ''}`}>
                      <span className={ui.label}>{f.label}</span>
                      {f.kind === 'select' ? (
                        <select
                          value={String(value ?? '')}
                          onChange={(e) => update(row.__id, f.key, e.target.value)}
                          aria-label={aria}
                          className="field h-9 overflow-hidden text-ellipsis whitespace-nowrap text-sm"
                        >
                          {(f.options ?? []).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                          {f.rowOptions
                            ? rows
                                .filter((r) => r.__id !== row.__id)
                                .map((r) => (
                                  <option key={r.__id} value={String(r[f.rowOptions!.value] ?? '')}>
                                    {String(r[f.rowOptions!.label] || '(নাম নেই)')}
                                  </option>
                                ))
                            : null}
                        </select>
                      ) : f.kind === 'checks' ? (
                        <details className="relative">
                          <summary className="field flex h-9 items-center text-sm before:hidden" aria-label={aria}>
                            <span className="truncate">
                              {Array.isArray(value) && value.length
                                ? (f.options ?? [])
                                    .filter((o) => (value as string[]).includes(o.value))
                                    .map((o) => o.label)
                                    .join(', ')
                                : 'সব'}
                            </span>
                          </summary>
                          <div className="absolute z-10 mt-1 flex max-h-64 w-64 flex-col gap-1 overflow-y-auto rounded-xl border border-rule bg-background p-2 shadow-lg">
                            {(f.options ?? []).map((o) => {
                              const list = Array.isArray(value) ? (value as string[]) : []
                              const on = list.includes(o.value)
                              return (
                                <label key={o.value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-key">
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => update(row.__id, f.key, on ? list.filter((x) => x !== o.value) : [...list, o.value])}
                                    className="size-4 accent-[var(--ink-fill)]"
                                  />
                                  {o.label}
                                </label>
                              )
                            })}
                          </div>
                        </details>
                      ) : (
                        <input
                          type={f.kind === 'number' ? 'number' : 'text'}
                          inputMode={f.kind === 'number' || f.kind === 'csv-number' ? 'decimal' : undefined}
                          value={String(display(f, value))}
                          step={f.step}
                          min={f.min}
                          max={f.max}
                          placeholder={f.placeholder}
                          readOnly={f.identity === 'locked' && isSaved}
                          title={f.identity === 'locked' && isSaved ? 'সংরক্ষিত কোড বদলানো যায় না — পুরোনো রেকর্ড এটির ওপর নির্ভর করে' : undefined}
                          onChange={(e) => update(row.__id, f.key, parse(f, e.target.value))}
                          aria-label={aria}
                          required={f.kind === 'text' || f.identity === 'locked'}
                          className={`field h-9 text-sm ${f.kind === 'number' ? 'num' : ''} ${f.identity === 'locked' && isSaved ? 'bg-key text-muted' : ''}`}
                        />
                      )}
                    </label>
                  )
                })}
              <div className={`flex items-center justify-end gap-1 ${ui.span}`}>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`সারি ${i + 1} ওপরে নিন`} className="btn-quiet size-9 px-0 disabled:opacity-30">
                  <ArrowUp className="size-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`সারি ${i + 1} নিচে নিন`} className="btn-quiet size-9 px-0 disabled:opacity-30">
                  <ArrowDown className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setRows((rs) => rs.filter((r) => r.__id !== row.__id))}
                  disabled={rows.length <= minRows}
                  aria-label={`সারি ${i + 1} বাদ দিন`}
                  className="btn-quiet size-9 px-0 text-alert disabled:opacity-30"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        })}
      </ol>
      <div>
        <button type="button" onClick={add} className="btn-quiet btn-sm">
          <Plus className="size-4" aria-hidden="true" />
          {addLabel}
        </button>
      </div>
    </div>
  )
}
