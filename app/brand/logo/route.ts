import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { factory } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'

/**
 * Serves the factory logo. A request carrying the current version is cached forever, since a new
 * upload bumps the version. SVGs are sandboxed so an uploaded file can never run script here.
 */
export async function GET(req: Request) {
  const [row] = await db.select({ logo: factory.logo, type: factory.logoType, version: factory.logoVersion }).from(factory).where(eq(factory.id, 1))
  if (!row?.logo || !row.type) return new Response('Not found', { status: 404 })
  const current = new URL(req.url).searchParams.get('v') === String(row.version)
  return new Response(new Uint8Array(row.logo), {
    headers: {
      'Content-Type': row.type,
      'Cache-Control': current ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
