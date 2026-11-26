import 'server-only'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { TechPackData } from './db/schema'

const FIELD_LABELS: Record<string, string> = {
  style: 'স্টাইল',
  garment: 'পোশাকের ধরন',
  fabric: 'কাপড়',
  gsm: 'জিএসএম',
  composition: 'উপাদান',
  colours: 'রং',
  sizes: 'সাইজ',
  wash: 'ওয়াশ ও যত্ন',
  smvTotal: 'মোট এসএমভি',
}

const schema = z.object({
  fields: z.array(
    z.object({
      key: z.enum(['style', 'garment', 'fabric', 'gsm', 'composition', 'colours', 'sizes', 'wash', 'smvTotal']),
      value: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      source: z.string().nullable().describe('the exact phrase in the tech pack this came from'),
    }),
  ),
  measurements: z
    .array(
      z.object({
        point: z.string().describe('point of measure, e.g. chest width 1/2'),
        sizes: z.record(z.string(), z.string()).describe('size name to measurement, in cm'),
        tolerance: z.string().nullable(),
      }),
    )
    .describe('the spec sheet rows'),
  trims: z.array(z.object({ item: z.string(), qtyPerPc: z.number().nullable(), note: z.string().nullable() })),
  operations: z.array(z.object({ name: z.string(), smv: z.number().nullable() })).describe('sewing operations and their standard minute values'),
})

export async function readTechPack(body: string): Promise<{ data: TechPackData; reader: 'ai' | 'pattern' }> {
  try {
    const { output } = await generateText({
      model: 'anthropic/claude-haiku-4.5',
      output: Output.object({ schema }),
      system:
        'You read garment tech packs for a Bangladeshi knit factory. Extract the header fields, the measurement spec sheet, the trims list and the sewing operation breakdown. If something is absent return null or an empty list. Never invent measurements, quantities or SMV values that are not written in the text.',
      prompt: body,
    })
    const fields = Object.keys(FIELD_LABELS).map((key) => {
      const f = output.fields.find((x) => x.key === key)
      return { key, label: FIELD_LABELS[key], value: f?.value ?? null, confidence: f?.confidence ?? 0, source: f?.source ?? null }
    })
    return { data: { fields, measurements: output.measurements, trims: output.trims, operations: output.operations }, reader: 'ai' }
  } catch (e) {
    console.error('[v0] tech pack ai read failed, using pattern reader:', e instanceof Error ? e.message : e)
    return { data: patternRead(body), reader: 'pattern' }
  }
}

function patternRead(body: string): TechPackData {
  const lines = body.split('\n').map((l) => l.trim()).filter(Boolean)
  const grab = (re: RegExp) => {
    const m = body.match(re)
    return m ? { value: m[1].trim(), source: m[0].trim() } : null
  }
  const found: Record<string, { value: string; source: string } | null> = {
    style: grab(/style(?:\s*no\.?)?[:\s]+([A-Z0-9-]{4,})/i),
    garment: grab(/(?:garment|description|product)[:\s]+([^\n]+)/i),
    fabric: grab(/fabric[:\s]+([^\n,]+)/i),
    gsm: grab(/(\d{2,3})\s*gsm/i),
    composition: grab(/(?:composition|content)[:\s]+([^\n]+)/i),
    colours: grab(/colou?rs?[:\s]+([^\n]+)/i),
    sizes: grab(/sizes?(?:\s*range)?[:\s]+([^\n]+)/i),
    wash: grab(/(?:wash|care)[:\s]+([^\n]+)/i),
    smvTotal: grab(/(?:total\s*smv|smv\s*total)[:\s]+([\d.]+)/i),
  }
  const fields = Object.keys(FIELD_LABELS).map((key) => ({
    key,
    label: FIELD_LABELS[key],
    value: found[key]?.value ?? null,
    confidence: found[key] ? 0.6 : 0,
    source: found[key]?.source ?? null,
  }))

  const sizeNames = (found.sizes?.value ?? 'S M L XL').split(/[\s,/-]+/).filter((s) => /^[A-Z0-9]{1,4}$/i.test(s))
  const measurements: TechPackData['measurements'] = []
  const trims: TechPackData['trims'] = []
  const operations: TechPackData['operations'] = []
  for (const l of lines) {
    const pom = l.match(/^([A-Za-z][A-Za-z /().-]{3,}?)\s+((?:\d+(?:\.\d+)?\s+){1,7}\d+(?:\.\d+)?)(?:\s+(?:tol\.?|±)\s*([\d.±+/-]+))?$/i)
    if (pom) {
      const nums = pom[2].trim().split(/\s+/)
      const sizes: Record<string, string> = {}
      nums.forEach((v, i) => (sizes[sizeNames[i] ?? `#${i + 1}`] = v))
      measurements.push({ point: pom[1].trim(), sizes, tolerance: pom[3] ?? null })
      continue
    }
    const trim = l.match(/^(?:-\s*)?([A-Za-z][A-Za-z\s-]*?(?:button|label|thread|tape|zip|zipper|tag|poly ?bag|sticker|elastic|interlining|carton)[A-Za-z\s-]*?)[:\s]+(\d+(?:\.\d+)?)\s*(?:pcs?|m|cm)?(?:\s*\/\s*pc)?/i)
    if (trim) {
      trims.push({ item: trim[1].trim(), qtyPerPc: Number(trim[2]), note: null })
      continue
    }
    const op = l.match(/^(?:\d+[.)]\s*)?([A-Za-z][A-Za-z\s&/-]{3,}?)\s+(\d\.\d{1,3})$/)
    if (op) operations.push({ name: op[1].trim(), smv: Number(op[2]) })
  }
  return { fields, measurements, trims, operations }
}
