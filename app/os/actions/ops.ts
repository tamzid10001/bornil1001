'use server'

import { bn, n } from '@/lib/format'
import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { employees, machines, tickets } from '@/lib/db/schema'
import { record, requireActor } from '@/lib/actor'
import { int, num, run, str, type ActionState } from '@/lib/action'

export async function openTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
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
    const actor = await requireActor()
    if (actor.role !== 'mechanic' && actor.role !== 'owner') throw new Error('শুধু রক্ষণাবেক্ষণ বিভাগ টিকিট বন্ধ করতে পারে।')
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

export async function updateAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    if (actor.role !== 'hr' && actor.role !== 'owner') throw new Error('শুধু এইচআর বিভাগ হাজিরা বদলাতে পারে।')
    const id = int(fd, 'employee_id')
    const daysPresent = int(fd, 'days', { min: 0, max: 31 })
    const otHours = num(fd, 'ot', { min: 0, max: 104 })
    const [e] = await db.update(employees).set({ daysPresent, otHours }).where(eq(employees.id, id)).returning()
    if (!e) throw new Error('কর্মী পাওয়া যায়নি।')
    await record(actor, 'হাজিরা হালনাগাদ করেছেন', 'employee', id, `${e.code}: ${bn(daysPresent)} দিন, ${bn(otHours)} ঘণ্টা ওটি`)
    revalidatePath('/os/payroll')
    return `${e.name}-এর হাজিরা হালনাগাদ হয়েছে`
  })
}

export async function addEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    if (actor.role !== 'hr' && actor.role !== 'owner') throw new Error('শুধু এইচআর বিভাগ কর্মী যোগ করতে পারে।')
    const name = str(fd, 'name')
    const section = str(fd, 'section')
    if (!name || !section) throw new Error('নাম ও সেকশন দিতে হবে।')
    const grade = int(fd, 'grade', { min: 1, max: 5 })
    const all = await db.select({ id: employees.id }).from(employees)
    const code = `E-${String(4001 + all.length)}`
    const lineRaw = str(fd, 'line')
    await db.insert(employees).values({ code, name, grade, section, line: lineRaw ? int(fd, 'line', { min: 1, max: 40 }) : null })
    await record(actor, 'কর্মী যোগ করেছেন', 'employee', null, `${code} ${name}, গ্রেড ${bn(grade)}`)
    revalidatePath('/os/payroll')
    return `${name} যোগ হয়েছে (${code})`
  })
}
