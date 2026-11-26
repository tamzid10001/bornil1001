const ACRONYMS = /\b(lcs?|btbs?|ud|pp|aql|fob|cm|b\/l|bl|ot|qc|qa|bom|tna|usd|bdt|po|dhu|smv)\b/gi

export function acronyms(text: string) {
  return text.replace(ACRONYMS, (m) => (m.toLowerCase() === 'bl' ? 'B/L' : m.toLowerCase().endsWith('s') && m.length > 2 && m.toLowerCase() !== 'cms' ? m.slice(0, -1).toUpperCase() + 's' : m.toUpperCase()))
}
