'use server'

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
    if (issue.length < 3) throw new Error('Describe the fault.')
    const [m] = await db.select().from(machines).where(eq(machines.id, machineId))
    if (!m) throw new Error('Machine not found.')
    const [open] = await db.select().from(tickets).where(and(eq(tickets.machineId, machineId), isNull(tickets.closedAt)))
    if (open) throw new Error(`${m.code} already has an open ticket.`)
    await db.insert(tickets).values({ machineId, issue })
    await db.update(machines).set({ status: 'down' }).where(eq(machines.id, machineId))
    await record(actor, 'raised a breakdown', 'machine', machineId, `${m.code}: ${issue}`)
    revalidatePath('/os', 'layout')
    return `${m.code} marked down — maintenance called`
  })
}

export async function closeTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    if (actor.role !== 'mechanic' && actor.role !== 'owner') throw new Error('Only maintenance can close a breakdown.')
    const id = int(fd, 'ticket_id')
    const [t] = await db.select().from(tickets).where(eq(tickets.id, id))
    if (!t || t.closedAt) throw new Error('Ticket is not open.')
    const downtime = Math.max(1, Math.round((Date.now() - t.openedAt.getTime()) / 60000))
    await db.update(tickets).set({ closedAt: new Date(), downtimeMin: downtime, mechanic: actor.name }).where(eq(tickets.id, id))
    await db.update(machines).set({ status: 'running' }).where(eq(machines.id, t.machineId))
    await record(actor, 'fixed a machine', 'machine', t.machineId, `${downtime} min down: ${str(fd, 'fix') || t.issue}`)
    revalidatePath('/os', 'layout')
    return `back running after ${downtime} min`
  })
}

export async function updateAttendance(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    if (actor.role !== 'hr' && actor.role !== 'owner') throw new Error('Only hr can change attendance.')
    const id = int(fd, 'employee_id')
    const daysPresent = int(fd, 'days', { min: 0, max: 31 })
    const otHours = num(fd, 'ot', { min: 0, max: 104 })
    const [e] = await db.update(employees).set({ daysPresent, otHours }).where(eq(employees.id, id)).returning()
    if (!e) throw new Error('Worker not found.')
    await record(actor, 'updated attendance', 'employee', id, `${e.code}: ${daysPresent} days, ${otHours} h ot`)
    revalidatePath('/os/payroll')
    return `${e.name} updated`
  })
}

export async function addEmployee(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireActor()
    if (actor.role !== 'hr' && actor.role !== 'owner') throw new Error('Only hr can add workers.')
    const name = str(fd, 'name')
    const section = str(fd, 'section')
    if (!name || !section) throw new Error('Name and section are required.')
    const grade = int(fd, 'grade', { min: 1, max: 5 })
    const all = await db.select({ id: employees.id }).from(employees)
    const code = `E-${String(4001 + all.length)}`
    const lineRaw = str(fd, 'line')
    await db.insert(employees).values({ code, name, grade, section, line: lineRaw ? int(fd, 'line', { min: 1, max: 40 }) : null })
    await record(actor, 'added a worker', 'employee', null, `${code} ${name}, grade ${grade}`)
    revalidatePath('/os/payroll')
    return `${name} added as ${code}`
  })
}
