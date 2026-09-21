'use server'

import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { attendanceLists, attendanceParticipants } from '@/lib/db/schema'

const creatorPassword = '1n54n1'
const listNameSchema = z.string().trim().min(1).max(8)
const listPasswordSchema = z.string().regex(/^\d{4}$/, 'The list password must contain 4 digits.')
const listIdSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}$/)
const fullNameSchema = z.string().trim().min(2).max(32)
const defaultDurationMinutes = 150
const durationMinutesSchema = z.coerce.number().int().min(1).max(1440)

function makeListId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

export async function createAttendanceList(listName: string, listPassword: string, durationMinutes = defaultDurationMinutes) {
  const parsedName = listNameSchema.safeParse(listName)
  const parsedPassword = listPasswordSchema.safeParse(listPassword)
  const parsedDuration = durationMinutesSchema.safeParse(durationMinutes)
  if (!parsedName.success) return { error: 'List name is required and must be 8 characters or fewer.' }
  if (!parsedPassword.success) return { error: 'The list password must be between 4 and 64 characters.' }
  if (!parsedDuration.success) return { error: 'Active duration must be between 1 and 1440 minutes.' }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = makeListId()
    const existing = await db.select({ id: attendanceLists.id }).from(attendanceLists).where(eq(attendanceLists.id, id)).limit(1)
    if (existing.length === 0) {
      const createdAt = new Date()
      const expiresAt = new Date(createdAt.getTime() + parsedDuration.data * 60 * 1000)
      await db.insert(attendanceLists).values({ id, listName: parsedName.data, creatorPassword, listPassword: parsedPassword.data, createdAt, expiresAt })
      return { id, expiresAt }
    }
  }

  return { error: 'Could not create a unique list. Please try again.' }
}

export async function getHostLists(password: string) {
  if (password !== creatorPassword) return { error: 'The host password is incorrect.' }
  const cookieStore = await cookies()
  cookieStore.set('host-access', 'granted', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8, path: '/' })
  const lists = await db.select().from(attendanceLists).orderBy(desc(attendanceLists.createdAt))
  const listsWithCounts = await Promise.all(lists.map(async (list) => {
    const [result] = await db.select({ participantCount: count() }).from(attendanceParticipants).where(eq(attendanceParticipants.listId, list.id))
    return { ...list, participantCount: Number(result?.participantCount ?? 0), participants: [] }
  }))
  return { lists: listsWithCounts }
}

export async function deleteAttendanceParticipant(password: string, listId: string, participantId: string) {
  if (password !== creatorPassword) return { error: 'The host password is incorrect.' }
  const parsedListId = listIdSchema.safeParse(listId)
  if (!parsedListId.success) return { error: 'The list ID is invalid.' }
  await db.delete(attendanceParticipants).where(and(eq(attendanceParticipants.id, participantId), eq(attendanceParticipants.listId, parsedListId.data)))
  revalidatePath('/')
  return { success: true }
}

export async function deleteAttendanceLists(password: string, listIds: string[]) {
  if (password !== creatorPassword) return { error: 'The host password is incorrect.' }
  const ids = listIds.map((id) => listIdSchema.safeParse(id)).filter((result): result is { success: true; data: string } => result.success).map((result) => result.data)
  if (ids.length === 0) return { error: 'Select at least one list.' }
  for (const id of ids) {
    await db.delete(attendanceParticipants).where(eq(attendanceParticipants.listId, id))
    await db.delete(attendanceLists).where(eq(attendanceLists.id, id))
  }
  revalidatePath('/')
  return { success: true }
}

export async function getAttendanceList(listId: string, password: string, mode: 'participant' | 'host') {
  const parsedId = listIdSchema.safeParse(listId)
  if (!parsedId.success) return { error: 'List ID must be 4 characters.' }
  const list = await db.select().from(attendanceLists).where(eq(attendanceLists.id, parsedId.data)).limit(1)
  if (!list[0]) return { error: 'That ID was not found in the attendance list.' }
  const validPassword = mode === 'host' ? password === creatorPassword : password === list[0].listPassword
  if (!validPassword) return { error: 'That password is not correct.' }
  const participants = await db.select().from(attendanceParticipants).where(eq(attendanceParticipants.listId, parsedId.data)).orderBy(asc(attendanceParticipants.createdAt))
  const requestHeaders = await headers()
  const ipAddress = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'unknown'
  const existingIp = await db.select({ id: attendanceParticipants.id }).from(attendanceParticipants).where(and(eq(attendanceParticipants.listId, parsedId.data), eq(attendanceParticipants.ipAddress, ipAddress))).limit(1)
  return { listId: list[0].id, listName: list[0].listName, createdAt: list[0].createdAt, expiresAt: list[0].expiresAt, participants, duplicateIp: existingIp.length > 0 }
}

export async function addParticipant(listId: string, password: string, fullName: string) {
  const parsedId = listIdSchema.safeParse(listId)
  const parsedName = fullNameSchema.safeParse(fullName)
  if (!parsedId.success) return { error: 'List ID must be 4 characters.' }
  if (!parsedName.success) return { error: 'Enter your full name.' }
  const list = await db.select({ id: attendanceLists.id, expiresAt: attendanceLists.expiresAt, listPassword: attendanceLists.listPassword }).from(attendanceLists).where(eq(attendanceLists.id, parsedId.data)).limit(1)
  if (!list[0]) return { error: 'That ID was not found in the attendance list.' }
  if (list[0].listPassword !== password) return { error: 'That password is not correct.' }
  if (list[0].expiresAt.getTime() <= Date.now()) return { error: 'This attendance list is closed.' }
  const existingParticipant = await db.select({ id: attendanceParticipants.id }).from(attendanceParticipants).where(and(eq(attendanceParticipants.listId, parsedId.data), eq(attendanceParticipants.fullName, parsedName.data))).limit(1)
  if (existingParticipant.length > 0) return { error: 'Your name is already on the attendance list.' }
  const requestHeaders = await headers()
  const ipAddress = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'unknown'
  const existingIp = await db.select({ id: attendanceParticipants.id }).from(attendanceParticipants).where(and(eq(attendanceParticipants.listId, parsedId.data), eq(attendanceParticipants.ipAddress, ipAddress))).limit(1)
  if (existingIp.length > 0) return { error: 'This device has already submitted attendance.' }
  try {
    await db.insert(attendanceParticipants).values({ listId: parsedId.data, fullName: parsedName.data, ipAddress })
  } catch {
    return { error: 'This device has already submitted attendance.' }
  }
  revalidatePath('/')
  return { success: true }
}
