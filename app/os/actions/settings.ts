'use server'

import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { defects, employees, factory, floors, lines, machines, people, roles, sewing, settings } from '@/lib/db/schema'
import { ACTOR_COOKIE, record, requireActor, requirePermission } from '@/lib/actor'
import { int, num, run, str, type ActionState } from '@/lib/action'
import { getConfig, getFactory, getRoles, saveSection } from '@/lib/settings'
import {
  AQL_VALUES,
  DEFAULT_CATEGORIES,
  GATES,
  LINE_KINDS,
  makeKey,
  MODULES,
  PERMISSION_KEYS,
  SECTIONS,
  STAGES,
  tnaProblem,
  type Milestone,
  type NumberingKey,
  type SectionKey,
} from '@/lib/config'
import { bn } from '@/lib/format'

const cookieOpts = { path: '/', sameSite: 'lax' as const, httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 24 * 365 }

const SECTION_LABEL: Record<SectionKey, string> = {
  categories: 'পোশাকের ধরন',
  departments: 'বিভাগ',
  machineTypes: 'মেশিনের ধরন',
  defects: 'ত্রুটির তালিকা',
  tna: 'ক্রিটিক্যাল পাথের টেমপ্লেট',
  stages: 'অর্ডারের ধাপের নাম',
  production: 'উৎপাদন',
  quality: 'মান নিয়ন্ত্রণ',
  costing: 'কস্টিং',
  commercial: 'কমার্শিয়াল',
  payroll: 'বেতন কাঠামো',
  gates: 'গেট',
  modules: 'মডিউল',
  numbering: 'নম্বরের ধরন',
}

function refreshAll() {
  revalidatePath('/os', 'layout')
  revalidatePath('/docs', 'layout')
}

function optional(fd: FormData, key: string, max: number, label: string) {
  const v = str(fd, key)
  if (v.length > max) throw new Error(`${label} ${bn(max)} অক্ষরের মধ্যে লিখুন।`)
  return v || null
}

function emailOf(fd: FormData, key: string) {
  const v = str(fd, key).toLowerCase()
  if (!v) return null
  if (v.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error('একটি সঠিক ইমেইল ঠিকানা দিন।')
  return v
}

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']

async function logoOf(fd: FormData) {
  const file = fd.get('logo')
  if (!(file instanceof File) || file.size === 0) return null
  if (!LOGO_TYPES.includes(file.type)) throw new Error('লোগো PNG, JPG, WebP বা SVG ফাইল হতে হবে।')
  if (file.size > 512 * 1024) throw new Error('লোগো ৫১২ কিলোবাইটের মধ্যে হতে হবে।')
  const data = Buffer.from(await file.arrayBuffer())
  if (file.type === 'image/svg+xml' && /<script|\son[a-z]+\s*=|javascript:/i.test(data.toString('utf8'))) {
    throw new Error('এই SVG-তে স্ক্রিপ্ট আছে — অন্য একটি ফাইল দিন।')
  }
  return { data, type: file.type }
}

async function requireOwner() {
  const actor = await requireActor()
  if (!actor.isOwner) throw new Error('ভূমিকা ও অনুমতি শুধু মালিক বদলাতে পারেন।')
  return actor
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === '23505'

/* ---------- first run ---------- */

export async function setupFactory(_: ActionState, fd: FormData): Promise<ActionState> {
  const result = await run(async () => {
    const name = str(fd, 'name')
    if (!name || name.length > 120) throw new Error('কারখানার নাম দিন।')
    const ownerName = str(fd, 'owner_name')
    if (!ownerName || ownerName.length > 120) throw new Error('আপনার নাম দিন।')
    const ownerEmail = emailOf(fd, 'owner_email')
    const floorCount = int(fd, 'floors', { min: 1, max: 30, label: 'ফ্লোর সংখ্যা' })
    const perFloor = int(fd, 'lines_per_floor', { min: 0, max: 80, label: 'ফ্লোরপ্রতি লাইন' })
    const lineKind = LINE_KINDS[str(fd, 'line_kind')] ? str(fd, 'line_kind') : 'sewing'
    const hourly = int(fd, 'hourly_target', { min: 1, max: 5000, label: 'ঘণ্টাপ্রতি লক্ষ্য' })
    const picked = new Set(fd.getAll('categories').map(String))
    const categories = DEFAULT_CATEGORIES.filter((c) => picked.has(c.key))
    if (!categories.length) throw new Error('অন্তত একটি পোশাকের ধরন বেছে নিন।')
    const modules = Object.fromEntries(MODULES.map((m) => [m.key, fd.get(`module_${m.key}`) === 'on']))
    const logo = await logoOf(fd)
    const ownerRole = (await getRoles()).find((r) => r.isOwner)?.key ?? 'owner'

    const ownerId = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(727274002)`)
      const [{ c }] = await tx.select({ c: sql<number>`count(*)::int` }).from(people)
      if (c > 0) throw new Error('কারখানা আগেই সেটআপ করা হয়েছে।')
      const profile = {
        name,
        nameEn: optional(fd, 'name_en', 120, 'ইংরেজি নাম'),
        tagline: optional(fd, 'tagline', 160, 'পরিচিতি'),
        ...(logo ? { logo: logo.data, logoType: logo.type, logoVersion: 1 } : {}),
        updatedAt: new Date(),
      }
      await tx.insert(factory).values({ id: 1, ...profile }).onConflictDoUpdate({ target: factory.id, set: profile })
      const [owner] = await tx
        .insert(people)
        .values({ name: ownerName, role: ownerRole, dept: 'management', email: ownerEmail, phone: optional(fd, 'owner_phone', 40, 'ফোন') })
        .returning({ id: people.id })
      let lineNo = 0
      for (let f = 0; f < floorCount; f++) {
        const [floor] = await tx.insert(floors).values({ name: `ফ্লোর ${bn(f + 1)}`, sort: f }).returning({ id: floors.id })
        const rows = Array.from({ length: perFloor }, (_, i) => ({ floorId: floor.id, name: `লাইন ${bn(lineNo + i + 1)}`, kind: lineKind, hourlyTarget: hourly, sort: i }))
        lineNo += perFloor
        if (rows.length) await tx.insert(lines).values(rows)
      }
      for (const [key, value] of [
        ['categories', categories],
        ['modules', modules],
      ] as const) {
        await tx
          .insert(settings)
          .values({ key, value, updatedBy: owner.id })
          .onConflictDoUpdate({ target: settings.key, set: { value, updatedBy: owner.id, updatedAt: new Date() } })
      }
      return owner.id
    })
    ;(await cookies()).set(ACTOR_COOKIE, String(ownerId), cookieOpts)
  })
  if (result?.error) return result
  refreshAll()
  redirect('/os/settings?welcome=1')
}

/* ---------- profile & brand ---------- */

export async function saveProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const name = str(fd, 'name')
    if (!name || name.length > 120) throw new Error('কারখানার নাম দিন।')
    const values = {
      name,
      nameEn: optional(fd, 'name_en', 120, 'ইংরেজি নাম'),
      tagline: optional(fd, 'tagline', 160, 'পরিচিতি'),
      address: optional(fd, 'address', 300, 'ঠিকানা'),
      phone: optional(fd, 'phone', 40, 'ফোন'),
      email: emailOf(fd, 'email'),
      website: optional(fd, 'website', 120, 'ওয়েবসাইট'),
      bin: optional(fd, 'bin', 40, 'বিআইএন'),
      erc: optional(fd, 'erc', 40, 'ইআরসি'),
      irc: optional(fd, 'irc', 40, 'আইআরসি'),
      membership: optional(fd, 'membership', 80, 'সদস্য নম্বর'),
      updatedAt: new Date(),
    }
    await db.insert(factory).values({ id: 1, ...values }).onConflictDoUpdate({ target: factory.id, set: values })
    await record(actor, 'কারখানার প্রোফাইল হালনাগাদ করেছেন', 'factory', 1, name)
    refreshAll()
    return 'প্রোফাইল সংরক্ষণ করা হয়েছে'
  })
}

export async function saveLogo(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const logo = await logoOf(fd)
    if (!logo) throw new Error('একটি লোগো ফাইল বেছে নিন।')
    const current = await getFactory()
    const values = { logo: logo.data, logoType: logo.type, logoVersion: current.logoVersion + 1, updatedAt: new Date() }
    await db
      .insert(factory)
      .values({ id: 1, name: current.name, ...values })
      .onConflictDoUpdate({ target: factory.id, set: values })
    await record(actor, 'লোগো বদলেছেন', 'factory', 1, logo.type)
    refreshAll()
    return 'লোগো হালনাগাদ হয়েছে'
  })
}

export async function removeLogo(_: ActionState, __: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const current = await getFactory()
    await db.update(factory).set({ logo: null, logoType: null, logoVersion: current.logoVersion + 1, updatedAt: new Date() }).where(eq(factory.id, 1))
    await record(actor, 'লোগো সরিয়েছেন', 'factory', 1)
    refreshAll()
    return 'লোগো সরানো হয়েছে'
  })
}

/* ---------- roles & staff ---------- */

export async function saveRole(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireOwner()
    const id = str(fd, 'id') ? int(fd, 'id') : null
    const name = str(fd, 'name')
    if (!name || name.length > 60) throw new Error('ভূমিকার নাম দিন।')
    const permissions = [...new Set(fd.getAll('permissions').map(String))].filter((p) => PERMISSION_KEYS.includes(p))
    if (id) {
      const [r] = await db.select().from(roles).where(eq(roles.id, id))
      if (!r) throw new Error('ভূমিকা পাওয়া যায়নি।')
      await db.update(roles).set({ name, permissions: r.isOwner ? [] : permissions }).where(eq(roles.id, id))
      await record(actor, 'ভূমিকা হালনাগাদ করেছেন', 'role', id, `${name}: ${r.isOwner ? 'সব অনুমতি' : `${bn(permissions.length)}টি অনুমতি`}`)
    } else {
      const all = await db.select({ key: roles.key, sort: roles.sort }).from(roles)
      const key = makeKey(name, all.map((r) => r.key))
      const [r] = await db
        .insert(roles)
        .values({ key, name, permissions, sort: all.reduce((m, x) => Math.max(m, x.sort), 0) + 1 })
        .returning({ id: roles.id })
      await record(actor, 'নতুন ভূমিকা তৈরি করেছেন', 'role', r.id, `${name}: ${bn(permissions.length)}টি অনুমতি`)
    }
    refreshAll()
    return 'ভূমিকা সংরক্ষণ করা হয়েছে'
  })
}

export async function deleteRole(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireOwner()
    const id = int(fd, 'id')
    const [r] = await db.select().from(roles).where(eq(roles.id, id))
    if (!r) throw new Error('ভূমিকা পাওয়া যায়নি।')
    if (r.isOwner) throw new Error('মালিকের ভূমিকা মোছা যায় না।')
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(people).where(eq(people.role, r.key))
    if (c) throw new Error(`${bn(c)} জন কর্মীর এই ভূমিকা আছে — আগে তাঁদের অন্য ভূমিকা দিন।`)
    await db.delete(roles).where(eq(roles.id, id))
    await record(actor, 'ভূমিকা মুছেছেন', 'role', id, r.name)
    refreshAll()
    return `${r.name} মোছা হয়েছে`
  })
}

export async function savePerson(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('staff.manage')
    const [all, config] = await Promise.all([getRoles(), getConfig()])
    const id = str(fd, 'id') ? int(fd, 'id') : null
    const name = str(fd, 'name')
    if (!name || name.length > 120) throw new Error('কর্মীর নাম দিন।')
    const role = all.find((r) => r.key === str(fd, 'role'))
    if (!role) throw new Error('একটি ভূমিকা বেছে নিন।')
    const dept = str(fd, 'dept')
    if (!config.departments.some((d) => d.key === dept)) throw new Error('একটি বিভাগ বেছে নিন।')
    if (role.isOwner && !actor.isOwner) throw new Error('শুধু মালিক কাউকে মালিকের ভূমিকা দিতে পারেন।')
    const active = id ? fd.get('active') === 'on' : true
    const values = { name, role: role.key, dept, email: emailOf(fd, 'email'), phone: optional(fd, 'phone', 40, 'ফোন'), active }
    const ownerKeys = all.filter((r) => r.isOwner).map((r) => r.key)
    try {
      if (id) {
        const [p] = await db.select().from(people).where(eq(people.id, id))
        if (!p) throw new Error('কর্মী পাওয়া যায়নি।')
        const wasOwner = ownerKeys.includes(p.role)
        if (wasOwner && !actor.isOwner) throw new Error('মালিকের তথ্য শুধু মালিক বদলাতে পারেন।')
        if (wasOwner && (!role.isOwner || !active)) {
          const [{ c }] = await db
            .select({ c: sql<number>`count(*)::int` })
            .from(people)
            .where(and(inArray(people.role, ownerKeys), eq(people.active, true), ne(people.id, id)))
          if (!c) throw new Error('অন্তত একজন সক্রিয় মালিক থাকতে হবে।')
        }
        await db.update(people).set(values).where(eq(people.id, id))
        await record(actor, 'কর্মীর তথ্য হালনাগাদ করেছেন', 'person', id, `${name} · ${role.name}${active ? '' : ' · নিষ্ক্রিয়'}`)
      } else {
        const [p] = await db.insert(people).values(values).returning({ id: people.id })
        await record(actor, 'কর্মী যোগ করেছেন', 'person', p.id, `${name} · ${role.name}`)
      }
    } catch (e) {
      if (isUniqueViolation(e)) throw new Error('এই ইমেইল অন্য একজন কর্মীর নামে আছে।')
      throw e
    }
    refreshAll()
    return `${name}-এর তথ্য সংরক্ষণ করা হয়েছে`
  })
}

/* ---------- floor plan ---------- */

export async function saveFloor(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const id = str(fd, 'id') ? int(fd, 'id') : null
    const name = str(fd, 'name')
    if (!name || name.length > 60) throw new Error('ফ্লোরের নাম দিন।')
    const building = optional(fd, 'building', 60, 'ভবন')
    if (id) await db.update(floors).set({ name, building }).where(eq(floors.id, id))
    else {
      const [{ m }] = await db.select({ m: sql<number>`coalesce(max(sort), -1)::int` }).from(floors)
      await db.insert(floors).values({ name, building, sort: m + 1 })
    }
    await record(actor, id ? 'ফ্লোর হালনাগাদ করেছেন' : 'ফ্লোর যোগ করেছেন', 'floor', id, name)
    refreshAll()
    return `${name} সংরক্ষণ করা হয়েছে`
  })
}

export async function deleteFloor(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const id = int(fd, 'id')
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(lines).where(eq(lines.floorId, id))
    if (c) throw new Error('ফ্লোরে লাইন আছে — আগে লাইনগুলো সরান বা অন্য ফ্লোরে নিন।')
    const [f] = await db.delete(floors).where(eq(floors.id, id)).returning()
    if (!f) throw new Error('ফ্লোর পাওয়া যায়নি।')
    await record(actor, 'ফ্লোর মুছেছেন', 'floor', id, f.name)
    refreshAll()
    return `${f.name} মোছা হয়েছে`
  })
}

export async function saveLine(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const id = str(fd, 'id') ? int(fd, 'id') : null
    const floorId = int(fd, 'floor_id')
    const [floor] = await db.select().from(floors).where(eq(floors.id, floorId))
    if (!floor) throw new Error('একটি ফ্লোর বেছে নিন।')
    const name = str(fd, 'name')
    if (!name || name.length > 60) throw new Error('লাইনের নাম দিন।')
    const kind = str(fd, 'kind')
    if (!LINE_KINDS[kind]) throw new Error('লাইনের ধরন বেছে নিন।')
    const values = {
      floorId,
      name,
      kind,
      hourlyTarget: int(fd, 'hourly_target', { min: 1, max: 5000, label: 'ঘণ্টাপ্রতি লক্ষ্য' }),
      operators: int(fd, 'operators', { min: 0, max: 1000, label: 'অপারেটর' }),
      active: id ? fd.get('active') === 'on' : true,
    }
    if (id) await db.update(lines).set(values).where(eq(lines.id, id))
    else {
      const [{ m }] = await db.select({ m: sql<number>`coalesce(max(sort), -1)::int` }).from(lines).where(eq(lines.floorId, floorId))
      await db.insert(lines).values({ ...values, sort: m + 1 })
    }
    await record(actor, id ? 'লাইন হালনাগাদ করেছেন' : 'লাইন যোগ করেছেন', 'line', id, `${floor.name} · ${name}`)
    refreshAll()
    return `${name} সংরক্ষণ করা হয়েছে`
  })
}

export async function deleteLine(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const id = int(fd, 'id')
    const used = await Promise.all([
      db.select({ id: sewing.id }).from(sewing).where(eq(sewing.line, id)).limit(1),
      db.select({ id: defects.id }).from(defects).where(eq(defects.line, id)).limit(1),
      db.select({ id: machines.id }).from(machines).where(eq(machines.line, id)).limit(1),
      db.select({ id: employees.id }).from(employees).where(eq(employees.line, id)).limit(1),
    ])
    if (used.some((r) => r.length)) throw new Error('এই লাইনের উৎপাদন, মেশিন বা কর্মীর ইতিহাস আছে — মুছে না ফেলে “চালু” টিক তুলে বন্ধ রাখুন।')
    const [l] = await db.delete(lines).where(eq(lines.id, id)).returning()
    if (!l) throw new Error('লাইন পাওয়া যায়নি।')
    await record(actor, 'লাইন মুছেছেন', 'line', id, l.name)
    refreshAll()
    return `${l.name} মোছা হয়েছে`
  })
}

/* ---------- configurable sections ---------- */

function payload(fd: FormData): unknown {
  const raw = str(fd, 'payload')
  if (!raw || raw.length > 200_000) throw new Error('তালিকাটি পড়া যায়নি — পাতাটি আবার খুলে চেষ্টা করুন।')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('তালিকাটি পড়া যায়নি — পাতাটি আবার খুলে চেষ্টা করুন।')
  }
}

function assertUnique<T>(rows: T[], keyOf: (r: T) => string, labelOf: (r: T) => string) {
  const seen = new Set<string>()
  for (const r of rows) {
    const k = keyOf(r).trim()
    if (seen.has(k)) throw new Error(`“${labelOf(r)}”-এর কোড অন্য একটির সঙ্গে মিলে যাচ্ছে — প্রতিটি কোড আলাদা হতে হবে।`)
    seen.add(k)
  }
}

const NUMBERING_KEYS: NumberingKey[] = ['inquiry', 'quote', 'order', 'invoice', 'employee']

async function sectionValue(section: SectionKey, fd: FormData): Promise<unknown> {
  switch (section) {
    case 'categories': {
      const rows = payload(fd) as { key: string; label: string; unit: string; sizes: string[]; ratio: number[] }[]
      if (!Array.isArray(rows) || !rows.length) throw new Error('অন্তত একটি পোশাকের ধরন রাখুন।')
      assertUnique(rows, (r) => String(r.key ?? ''), (r) => String(r.label ?? ''))
      return rows.map((r) => ({ ...r, ratio: (r.sizes ?? []).map((_, i) => (Number.isInteger(r.ratio?.[i]) ? r.ratio[i] : 1)) }))
    }
    case 'departments':
    case 'machineTypes': {
      const rows = payload(fd) as { key: string; label: string }[]
      if (!Array.isArray(rows) || !rows.length) throw new Error('তালিকায় অন্তত একটি সারি রাখুন।')
      assertUnique(rows, (r) => String(r.key ?? ''), (r) => String(r.label ?? ''))
      return rows
    }
    case 'defects': {
      const rows = payload(fd) as { code: string; label: string }[]
      if (!Array.isArray(rows) || !rows.length) throw new Error('অন্তত একটি ত্রুটি রাখুন।')
      assertUnique(rows, (r) => String(r.code ?? ''), (r) => String(r.label ?? ''))
      return rows
    }
    case 'tna': {
      const rows = payload(fd) as Milestone[]
      if (!Array.isArray(rows) || !rows.length) throw new Error('অন্তত একটি মাইলস্টোন রাখুন।')
      const parsed = SECTIONS.tna.schema.safeParse(rows)
      if (!parsed.success) throw new Error('প্রতিটি মাইলস্টোনের নাম, বিভাগ ও দিন পূরণ করুন।')
      const problem = tnaProblem(parsed.data)
      if (problem) throw new Error(problem)
      const depts = new Set((await getConfig()).departments.map((d) => d.key))
      const stray = parsed.data.find((m) => !depts.has(m.dept))
      if (stray) throw new Error(`“${stray.label}”-এর বিভাগটি বিভাগের তালিকায় নেই।`)
      return parsed.data
    }
    case 'stages':
      return Object.fromEntries(STAGES.map((s) => [s, str(fd, s)]))
    case 'production':
      return {
        perLineDay: int(fd, 'perLineDay', { min: 10, max: 20000, label: 'লাইনপ্রতি দৈনিক পিস' }),
        fabricLeadDays: int(fd, 'fabricLeadDays', { min: 1, max: 180, label: 'কাপড়ের লিড টাইম' }),
        efficiencyAlert: int(fd, 'efficiencyAlert', { min: 30, max: 100, label: 'দক্ষতার সতর্কসীমা' }),
        shipBufferDays: int(fd, 'shipBufferDays', { min: 0, max: 60, label: 'শিপমেন্টের আগে সেলাই শেষের সময়' }),
        shiftStart: int(fd, 'shiftStart', { min: 0, max: 23, label: 'শিফট শুরু' }),
        hoursPerDay: int(fd, 'hoursPerDay', { min: 1, max: 24, label: 'দৈনিক কর্মঘণ্টা' }),
      }
    case 'quality': {
      const level = str(fd, 'level')
      const aql = Number(str(fd, 'aql'))
      if (!['I', 'II', 'III'].includes(level)) throw new Error('পরিদর্শন লেভেল বেছে নিন।')
      if (!(AQL_VALUES as readonly number[]).includes(aql)) throw new Error('একিউএল মান বেছে নিন।')
      return { level, aql }
    }
    case 'costing':
      return {
        floorMargin: num(fd, 'floorMargin', { min: 0, max: 90, label: 'ন্যূনতম মার্জিন' }),
        cmRate: num(fd, 'cmRate', { min: 0, max: 10000, label: 'মিনিটপ্রতি সিএম' }),
        fabricRate: num(fd, 'fabricRate', { min: 0, max: 1_000_000, label: 'কাপড়ের দর' }),
        overhead: num(fd, 'overhead', { min: 0, max: 1_000_000, label: 'ওভারহেড' }),
        wastagePct: num(fd, 'wastagePct', { min: 0, max: 50, label: 'অপচয়' }),
      }
    case 'commercial': {
      const portLoading = str(fd, 'portLoading')
      if (!portLoading || portLoading.length > 60) throw new Error('লোডিং বন্দরের নাম দিন।')
      return {
        portLoading,
        blTolerance: num(fd, 'blTolerance', { min: 0, max: 20, label: 'বি/এল পরিমাণের ছাড়' }),
        btbCap: num(fd, 'btbCap', { min: 10, max: 100, label: 'বিটুবির সীমা' }),
        tenorDays: int(fd, 'tenorDays', { min: 0, max: 360, label: 'মাস্টার এলসির মেয়াদ' }),
      }
    }
    case 'payroll': {
      const grades = payload(fd) as { grade: number; gross: number }[]
      if (!Array.isArray(grades) || !grades.length) throw new Error('অন্তত একটি গ্রেড রাখুন।')
      assertUnique(grades, (g) => String(g.grade), (g) => `গ্রেড ${bn(g.grade)}`)
      return {
        grades,
        allowances: num(fd, 'allowances', { min: 0, max: 1_000_000, label: 'নির্ধারিত ভাতা' }),
        basicDivisor: num(fd, 'basicDivisor', { min: 1, max: 4, label: 'মূল বেতনের ভাজক' }),
        otMultiplier: num(fd, 'otMultiplier', { min: 1, max: 4, label: 'ওটির গুণক' }),
        otHoursBase: num(fd, 'otHoursBase', { min: 50, max: 400, label: 'মাসিক ঘণ্টা' }),
        workingDays: int(fd, 'workingDays', { min: 20, max: 31, label: 'কর্মদিবস' }),
        attendanceBonus: num(fd, 'attendanceBonus', { min: 0, max: 1_000_000, label: 'হাজিরা বোনাস' }),
      }
    }
    case 'gates':
      return Object.fromEntries(GATES.map((g) => [g, fd.get(g) === 'on']))
    case 'modules':
      return Object.fromEntries(MODULES.map((m) => [m.key, fd.get(m.key) === 'on']))
    case 'numbering':
      return Object.fromEntries(
        NUMBERING_KEYS.map((k) => {
          const prefix = str(fd, `${k}_prefix`)
          if (prefix.length > 24 || !/^[A-Za-z0-9\-/_.{} ]*$/.test(prefix)) throw new Error('নম্বরের শুরুতে শুধু ইংরেজি অক্ষর, সংখ্যা, - / _ . এবং {YYYY} ব্যবহার করুন।')
          return [k, { prefix, pad: int(fd, `${k}_pad`, { min: 0, max: 8, label: 'অঙ্ক' }) }]
        }),
      )
  }
}

export async function saveSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const section = str(fd, 'section') as SectionKey
    if (!(section in SECTIONS)) throw new Error('অজানা সেটিং।')
    await saveSection(section, await sectionValue(section, fd), actor.id)
    await record(actor, 'সেটিংস বদলেছেন', 'settings', null, SECTION_LABEL[section])
    refreshAll()
    return `${SECTION_LABEL[section]} সংরক্ষণ করা হয়েছে`
  })
}

export async function resetSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('settings.manage')
    const section = str(fd, 'section') as SectionKey
    if (!(section in SECTIONS)) throw new Error('অজানা সেটিং।')
    await db.delete(settings).where(eq(settings.key, section))
    await record(actor, 'সেটিংস ডিফল্টে ফিরিয়েছেন', 'settings', null, SECTION_LABEL[section])
    refreshAll()
    return `${SECTION_LABEL[section]} শুরুর অবস্থায় ফেরানো হয়েছে`
  })
}
