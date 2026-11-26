import { pool } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Liveness for uptime monitors: database reachable and the latest applied migration. */
export async function GET() {
  const started = Date.now()
  try {
    const { rows } = await pool.query<{ name: string | null }>('select max(name) as name from _migrations')
    return Response.json(
      { ok: true, database: 'up', migration: rows[0]?.name ?? null, latencyMs: Date.now() - started },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return Response.json({ ok: false, database: 'down', latencyMs: Date.now() - started }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
