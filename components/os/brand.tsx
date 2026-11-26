type Brand = { name: string; nameEn: string | null; logoUrl: string | null }

function monogram(b: Brand) {
  const source = (b.nameEn || b.name).trim()
  const first = new Intl.Segmenter('bn', { granularity: 'grapheme' }).segment(source)[Symbol.iterator]().next().value?.segment
  return (first ?? '·').toUpperCase()
}

/** The factory's uploaded logo, or a monogram of its name when there is none. */
export function BrandMark({ brand, size = 'md' }: { brand: Brand; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-14' : 'h-9'
  if (brand.logoUrl) {
    return <img src={brand.logoUrl} alt={`${brand.name}-এর লোগো`} className={`${box} w-auto max-w-40 shrink-0 object-contain`} />
  }
  return (
    <span aria-hidden="true" className={`${box} flex aspect-square shrink-0 items-center justify-center rounded-lg bg-ink-fill font-heading font-semibold text-on-ink ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>
      {monogram(brand)}
    </span>
  )
}
