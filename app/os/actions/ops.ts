'use server'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { employees, machines, tickets } from '@/lib/db/schema'
import { record, requirePermission } from '@/lib/actor'
import { int, num, run, str, type ActionState } from '@/lib/action'
import { activeLine } from '@/lib/order-guard'
import { nextCode } from '@/lib/codes'
import { getConfig } from '@/lib/settings'
import { optionLabel } from '@/lib/config'
import { bn, n } from '@/lib/format'

export async function openTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('maintenance.report')
    const machineId = int(fd, 'machine_id')
    const issue = str(fd, 'issue')
    if (issue.length < 3) throw new Error('সমস্যাটি লিখুন।')
    const [m] = await db.select().from(machines).where(eq(machines.id, machineId))
    if (!m) throw new Error('মেশিন পাওয়া যায়নি।')
    const [open] = await db.select().from(tickets).where(and(eq(tickets.machineId, machineId), isNull(tickets.closedAt)))
    if (open) throw new Error(`${m.code}-এর একটি টিকিট আগে থেকেই খোলা আছে।`)
    await db.insert(tickets).values({ machineId, issue })
    await db.update(machines).set({ status: 'down' }).where(eq(machines.id, machineId))
    await record(actor, 'ব্রেকডাউন জানিয়েছেন', 'machine', machineId, `${m.code}: ${issue}`)
    revalidatePath('/os', 'layout')
    return `${m.code} বন্ধ হিসেবে চিহ্নিত করা হয়েছে — রক্ষণাবেক্ষণ বিভাগকে জানানো হয়েছে`
  })
}

export async function closeTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('maintenance.manage')
    const id = int(fd, 'ticket_id')
    const [t] = await db.select().from(tickets).where(eq(tickets.id, id))
    if (!t || t.closedAt) throw new Error('টিকিটটি খোলা নেই।')
    const downtime = Math.max(1, Math.round((Date.now() - t.openedAt.getTime()) / 60000))
    await db.update(tickets).set({ closedAt: new Date(), downtimeMin: downtime, mechanic: actor.name }).where(eq(tickets.id, id))
    await db.update(machines).set({ status: 'running' }).where(eq(machines.id, t.machineId))
    await record(actor, 'মেশিন ঠিক করেছেন', 'machine', t.machineId, `${n(downtime)} মিনিট বন্ধ: ${str(fd, 'fix') || t.issue}`)
    revalidatePath('/os', 'layout')
    return `${n(downtime)} মিনিট পর আবার চালু হয়েছে`
  })
}

export async function addMachine(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('maintenance.manage')
    const config = await getConfig()
    const code = str(fd, 'code').toUpperCase()
    if (!/^[A-Z0-9][A-Z0-9\-/.]{0,23}$/.test(code)) throw new Error('মেশিনের কোড দিন — ইংরেজি অক্ষর, সংখ্যা ও হাইফেন।')
    const kind = str(fd, 'kind')
    if (!config.machineTypes.some((t) => t.key === kind)) throw new Error('মেশিনের ধরন বেছে নিন।')
    const line = str(fd, 'line') ? await activeLine(fd) : null
    const [{ c }] = await db.select({ c: sql<number>`count(*)::int` }).from(machines).where(eq(machines.code, code))
    if (c) throw new Error(`${code} কোডের মেশিন আগে থেকেই আছে।`)
    await db.insert(machines).values({ code, kind, line: line?.id ?? null })
    await record(actor, 'মেশিন যোগ করেছেন', 'machine', null, `${code} · ${optionLabel(config.machineTypes, kind)}${line ? ` · ${line.name}` : ''}`)
    revalidatePath('/os/maintenance')
    return `${code} যোগ হয়েছে`
  })
}

export async function updateAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('payroll.manage')
    const config = await getConfig()
    const id = int(fd, 'employee_id')
    const daysPresent = int(fd, 'days', { min: 0, max: 31, label: 'উপস্থিতি' })
    const otHours = num(fd, 'ot', { min: 0, max: 200, label: 'ওভারটাইম' })
    if (daysPresent > config.payroll.workingDays + 5) throw new Error('উপস্থিতির দিন মাসের কর্মদিবসের চেয়ে অনেক বেশি।')
    const [e] = await db.update(employees).set({ daysPresent, otHours }).where(eq(employees.id, id)).returning()
    if (!e) throw new Error('কর্মী পাওয়া যায়নি।')
    await record(actor, 'হাজিরা হালনাগাদ করেছেন', 'employee', id, `${e.code}: ${bn(daysPresent)} দিন, ${bn(otHours)} ঘণ্টা ওটি`)
    revalidatePath('/os/payroll')
    return `${e.name}-এর হাজিরা হালনাগাদ হয়েছে`
  })
}

export async function addEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requirePermission('payroll.manage')
    const config = await getConfig()
    const name = str(fd, 'name')
    const section = str(fd, 'section')
    if (!name || !section) throw new Error('নাম ও সেকশন দিতে হবে।')
    const grade = int(fd, 'grade', { min: 1, max: 30, label: 'গ্রেড' })
    if (!config.payroll.grades.some((g) => g.grade === grade)) throw new Error('বেতন কাঠামোতে থাকা একটি গ্রেড বেছে নিন।')
    const line = str(fd, 'line') ? await activeLine(fd) : null
    const code = await nextCode('employee', config.numbering)
    await db.insert(employees).values({ code, name, grade, section, line: line?.id ?? null })
    await record(actor, 'কর্মী যোগ করেছেন', 'employee', null, `${code} ${name}, গ্রেড ${bn(grade)}`)
    revalidatePath('/os/payroll')
    return `${name} যোগ হয়েছে (${code})`
  })
}
