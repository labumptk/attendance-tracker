import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { asc, eq } from 'drizzle-orm'
import { ArrowLeft, LockKeyhole } from 'lucide-react'
import { db } from '@/lib/db'
import { attendanceLists, attendanceParticipants } from '@/lib/db/schema'

export default async function ListDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const access = (await cookies()).get('host-access')?.value
  if (access !== 'granted') redirect('/')
  const { id } = await params
  const list = (await db.select().from(attendanceLists).where(eq(attendanceLists.id, id.toUpperCase())).limit(1))[0]
  if (!list) redirect('/')
  const participants = await db.select().from(attendanceParticipants).where(eq(attendanceParticipants.listId, list.id)).orderBy(asc(attendanceParticipants.createdAt))
  const formatDate = (value: Date) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(value)
  return <main className="min-h-screen bg-[#f8f9fa] text-black"><div className="mx-auto min-h-screen max-w-4xl px-5 py-6 sm:px-8 lg:px-12"><header className="flex items-center justify-between"><Link href="/" className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black"><ArrowLeft size={16} /> Kembali ke dasbor</Link><span className="flex items-center gap-2 text-xs text-gray-400"><LockKeyhole size={13} /> Host</span></header><section className="py-12"><div className="mb-8"><p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-700">Detail daftar</p><h1 className="text-4xl font-bold tracking-tight">{list.listName}</h1><p className="mt-3 text-sm text-gray-500">Dibuat {formatDate(list.createdAt)} · {participants.length} peserta</p></div><div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="grid grid-cols-[1fr_auto] gap-4 border-b border-gray-100 px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500"><span>Nama</span><span>Waktu</span></div>{participants.length === 0 ? <p className="px-5 py-12 text-center text-sm text-gray-500">Belum ada peserta.</p> : participants.map((participant) => <div key={participant.id} className="grid grid-cols-[1fr_auto] gap-4 border-b border-gray-100 px-5 py-4 last:border-0"><span className="font-medium">{participant.fullName}</span><span className="text-sm text-gray-500">{formatDate(participant.createdAt)}</span></div>)}</div></section></div></main>
}
