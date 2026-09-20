import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { asc, desc, eq } from 'drizzle-orm'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { db } from '@/lib/db'
import { attendanceLists, attendanceParticipants } from '@/lib/db/schema'

export default async function ListDetailsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ order?: string }> }) {
  const access = (await cookies()).get('host-access')?.value
  if (access !== 'granted') redirect('/')
  const { id } = await params
  const { order } = await searchParams
  const list = (await db.select().from(attendanceLists).where(eq(attendanceLists.id, id.toUpperCase())).limit(1))[0]
  if (!list) redirect('/')
  const sortOrder = order === 'az' || order === 'za' || order === 'newest' || order === 'oldest' ? order : 'oldest'
  const participantOrder = sortOrder === 'az' ? asc(attendanceParticipants.fullName) : sortOrder === 'za' ? desc(attendanceParticipants.fullName) : sortOrder === 'newest' ? desc(attendanceParticipants.createdAt) : asc(attendanceParticipants.createdAt)
  const participants = await db.select().from(attendanceParticipants).where(eq(attendanceParticipants.listId, list.id)).orderBy(participantOrder)
  const formatDate = (value: Date) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value)
  const status = list.expiresAt.getTime() > Date.now() ? 'Aktif' : 'Ditutup'
  return <main className="min-h-screen bg-[#f8f9fa] text-black"><div className="mx-auto min-h-screen max-w-4xl px-5 py-6 sm:px-8 lg:px-12"><header className="flex items-center justify-between"><Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black"><ArrowLeft size={16} /> Kembali ke dasbor</Link><span className="flex items-center gap-2 text-xs text-gray-400"><LockKeyhole size={13} /> Host</span></header><section className="py-12"><div className="mb-8"><p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-700">Detail daftar</p><h1 className="text-4xl font-bold tracking-tight">{list.listName}</h1><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500"><span>Kode: <strong className="font-semibold text-gray-900">{list.id}</strong></span><span>Dibuat: {formatDate(list.createdAt)}</span><span>{participants.length} peserta</span><span className="inline-flex items-center gap-2">Status: {status === 'Ditutup' ? <strong className="rounded-full bg-gray-200 px-3 py-1 text-xs font-bold tracking-wide text-gray-700">DITUTUP</strong> : <strong className="font-semibold text-gray-900">{status}</strong>}</span></div></div><div className="mb-4 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Peserta</h2><form method="get" className="flex items-center gap-2"><label htmlFor="order" className="text-sm text-gray-500">Urutkan</label><select id="order" name="order" defaultValue={sortOrder} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm" aria-label="Urutkan peserta"><option value="az">A ke Z</option><option value="za">Z ke A</option><option value="newest">Terbaru</option><option value="oldest">Terlama</option></select><button type="submit" className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white">Urutkan</button></form></div><div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="grid grid-cols-[1fr_auto] gap-4 border-b border-gray-100 px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500"><span>Nama</span><span>Waktu</span></div>{participants.length === 0 ? <p className="px-5 py-12 text-center text-sm text-gray-500">Belum ada peserta.</p> : participants.map((participant) => <div key={participant.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-gray-100 px-5 py-4 last:border-0"><span className="font-medium">{participant.fullName}</span><span className="text-sm text-gray-500">{formatDate(participant.createdAt)}</span></div>)}</div></section></div></main>
}
