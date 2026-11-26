import 'server-only'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { ExtractedField } from './db/schema'

const FIELD_LABELS: Record<string, string> = {
  style: 'স্টাইল',
  fabric: 'কাপড়',
  quantity: 'পরিমাণ (পিস)',
  ratio: 'সাইজ অনুপাত',
  shipDate: 'শিপমেন্টের তারিখ',
  incoterm: 'ইনকোটার্ম ও বন্দর',
  targetPrice: 'লক্ষ্য দর (৳/পিস)',
}

const schema = z.object({
  fields: z.array(
    z.object({
      key: z.enum(['style', 'fabric', 'quantity', 'ratio', 'shipDate', 'incoterm', 'targetPrice']),
      value: z.string().nullable().describe('normalised value. quantity as an integer, shipDate as YYYY-MM-DD, targetPrice as a number in taka (BDT) per piece'),
      confidence: z.number().min(0).max(1),
      source: z.string().nullable().describe('the exact phrase in the email this was read from'),
    }),
  ),
})

export async function extractInquiry(body: string): Promise<ExtractedField[]> {
  try {
    const { output } = await generateText({
      model: 'anthropic/claude-haiku-4.5',
      output: Output.object({ schema }),
      system:
        'You read garment buyer inquiry emails for a Bangladeshi knit factory. Extract each field. If a field is absent, return value null and confidence 0. Never guess a number that is not in the email.',
      prompt: body,
    })
    return Object.keys(FIELD_LABELS).map((key) => {
      const f = output.fields.find((x) => x.key === key)
      return { key, label: FIELD_LABELS[key], value: f?.value ?? null, confidence: f?.confidence ?? 0, source: f?.source ?? null }
    })
  } catch (e) {
    console.error('[v0] ai extraction failed, using pattern reader:', e instanceof Error ? e.message : e)
    return patternExtract(body)
  }
}

function patternExtract(body: string): ExtractedField[] {
  const find = (re: RegExp) => body.match(re)
  const style = find(/style[:\s]+([A-Z0-9-]{4,})/i)
  const fabric = find(/fabric[:\s]+([^\n.,]+)/i)
  const qty = find(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*(?:pcs|pieces)/i)
  const ratio = find(/ratio[:\s]+([^\n.]+)/i)
  const date = find(/(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/)
  const inco = find(/(FOB|CIF|CFR|FCA)\s+([A-Za-z]+)/)
  const price = find(/(?:bdt|tk\.?|taka|৳)\s*(\d+(?:\.\d+)?)/i)
  const parsedDate = date ? new Date(`${date[1]} UTC`) : null
  const values: Record<string, [string | null, string | null]> = {
    style: [style?.[1] ?? null, style?.[0] ?? null],
    fabric: [fabric?.[1]?.trim() ?? null, fabric?.[0] ?? null],
    quantity: [qty ? qty[1].replace(/,/g, '') : null, qty?.[0] ?? null],
    ratio: [ratio?.[1]?.trim() ?? null, ratio?.[0] ?? null],
    shipDate: [parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : null, date?.[0] ?? null],
    incoterm: [inco ? `${inco[1]} ${inco[2]}` : null, inco?.[0] ?? null],
    targetPrice: [price?.[1] ?? null, price?.[0] ?? null],
  }
  return Object.keys(FIELD_LABELS).map((key) => ({
    key,
    label: FIELD_LABELS[key],
    value: values[key][0],
    confidence: values[key][0] ? 0.6 : 0,
    source: values[key][1],
  }))
}
