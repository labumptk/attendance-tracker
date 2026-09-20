"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  Clipboard,
  ListChecks,
  LockKeyhole,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  addParticipant,
  createAttendanceList,
  deleteAttendanceLists,
  deleteAttendanceParticipant,
  getAttendanceList,
  getHostLists,
} from "./actions/attendance";
import type { AttendanceParticipant } from "@/lib/db/schema";

type HostList = {
  id: string;
  listName: string;
  createdAt: Date;
  expiresAt: Date;
  participantCount: number;
  participants: AttendanceParticipant[];
};
type Mode = "home" | "create" | "join" | "host-access" | "host";

export default function Page() {
  const [mode, setMode] = useState<Mode>("home");
  const [listId, setListId] = useState(""),
    [listName, setListName] = useState(""),
    [participantListName, setParticipantListName] = useState(""),
    [password, setPassword] = useState(""),
    [masterPassword, setMasterPassword] = useState(""),
    [name, setName] = useState("");
  const [created, setCreated] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [hostLists, setHostLists] = useState<HostList[]>([]),
    [selected, setSelected] = useState<string[]>([]),
    [selectedList, setSelectedList] = useState<HostList | null>(null),
    [listOrder, setListOrder] = useState<"newest" | "oldest">("newest"),
    [participantSort, setParticipantSort] = useState<
      Record<string, "az" | "za" | "newest" | "oldest" | "name" | "time">
    >({});
  const [participants, setParticipants] = useState<AttendanceParticipant[]>([]),
    [participantReady, setParticipantReady] = useState(false),
    [duplicateIp, setDuplicateIp] = useState(false),
    [directJoin, setDirectJoin] = useState(false),
    [shareLink, setShareLink] = useState(""),
    [expiresAt, setExpiresAt] = useState("");
  const [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search),
      id = params.get("list")?.toUpperCase(),
      sharedPassword = params.get("password"),
      sharedExpiresAt = params.get("expiresAt"),
      sharedListName = params.get("name");
    if (id && sharedPassword) {
      setListId(id);
      setPassword(sharedPassword);
      setParticipantListName(sharedListName || "");
      setExpiresAt(sharedExpiresAt || "");
      setDirectJoin(true);
      setMode("join");
    }
  }, []);

  function reset() {
    setMode("home");
    setListId("");
    setListName("");
    setParticipantListName("");
    setPassword("");
    setMasterPassword("");
    setName("");
    setCreated(null);
    setHostLists([]);
    setSelected([]);
    setSelectedList(null);
    setParticipants([]);
    setParticipantReady(false);
    setDuplicateIp(false);
    setDirectJoin(false);
    setShareLink("");
    setMessage("");
  }
  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const normalizedName = listName.trim().toUpperCase();
    if (!/^\d{4}$/.test(password)) {
      setMessage("The list password must contain 4 digits.");
      return;
    }
    setLoading(true);
    setMessage("");
    const result = await createAttendanceList(
      normalizedName,
      password,
      masterPassword,
    );
    setLoading(false);
    if ("error" in result) setMessage(result.error);
    else {
      setCreated({ id: result.id, name: listName.trim() });
      setExpiresAt(result.expiresAt.toISOString());
      setShareLink(
        `${window.location.origin}?list=${result.id}&name=${encodeURIComponent(normalizedName)}&password=${encodeURIComponent(password)}&expiresAt=${encodeURIComponent(result.expiresAt.toISOString())}`,
      );
      setListId(result.id);
      setPassword("");
      setMessage("List created. The participant link is ready to share.");
    }
  }
  async function handleJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const result = await getAttendanceList(listId, password, "participant");
    setLoading(false);
    if ("error" in result) setMessage(result.error);
    else {
      setExpiresAt(result.expiresAt.toISOString());
      setParticipantListName(result.listName);
      setDuplicateIp(result.duplicateIp);
      setParticipantReady(true);
      setMessage("");
    }
  }
  async function handleHost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const result = await getHostLists(password);
    setLoading(false);
    if ("error" in result) setMessage(result.error);
    else {
      setHostLists(result.lists);
      setListOrder("newest");
      setMode("host");
    }
  }
  async function openListDetails(list: HostList) {
    setLoading(true);
    setMessage("");
    const result = await getAttendanceList(list.id, password, "host");
    setLoading(false);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    setSelectedList({ ...list, participants: result.participants });
    setParticipantSort((current) => ({ ...current, [list.id]: "oldest" }));
  }
  async function handleAttendance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const result = await addParticipant(listId, password, name);
    setLoading(false);
    if ("error" in result) setMessage(result.error);
    else {
      setName("");
      setMessage("Your attendance has been recorded.");
    }
  }
  async function copyText(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  async function removeSelected() {
    if (!confirm("Delete the selected lists and all their participants?"))
      return;
    setLoading(true);
    const result = await deleteAttendanceLists(password, selected);
    setLoading(false);
    if ("error" in result) setMessage(result.error);
    else {
      setHostLists((lists) =>
        lists.filter((list) => !selected.includes(list.id)),
      );
      setSelected([]);
      setMessage("Selected lists have been deleted.");
    }
  }
  async function removeParticipant(listId: string, participantId: string) {
    if (!confirm("Remove this participant from the list?")) return;
    setLoading(true);
    const result = await deleteAttendanceParticipant(
      password,
      listId,
      participantId,
    );
    setLoading(false);
    if ("error" in result) setMessage(result.error);
    else {
      setHostLists((lists) =>
        lists.map((list) =>
          list.id === listId
            ? {
                ...list,
                participants: list.participants.filter(
                  (participant) => participant.id !== participantId,
                ),
              }
            : list,
        ),
      );
      setMessage("Participants telah dihapus.");
    }
  }
  function exportCsv(list: HostList) {
    const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [
      ["Name", "IP address", "Time"],
      ...list.participants.map((p) => [
        p.fullName,
        p.ipAddress,
        p.createdAt ? formatDateTime(p.createdAt) : "",
      ]),
    ];
    const blob = new Blob(
      [rows.map((r) => r.map(esc).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hadir-${list.id}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  const field =
      "mt-2 h-12 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-black outline-none transition focus:border-gray-500 focus:ring-4 focus:ring-gray-500/10",
    primary =
      "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-black px-5 text-sm font-semibold text-white shadow-lg shadow-black/15 transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60";
  const error =
    message &&
    !message.toLowerCase().includes("sudah ada") &&
    message !== "Your attendance has been recorded." &&
    message !== "List created. The participant link is ready to share." &&
    message !== "Selected lists have been deleted.";
  const participantClosed = Boolean(
    expiresAt && Date.now() >= new Date(expiresAt).getTime(),
  );
  const duplicateName = message.toLowerCase().includes("sudah ada");
  const formatDateTime = (value: Date | string) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(value));
  const formattedCloseTime = expiresAt
    ? formatDateTime(expiresAt)
    : "2,5 jam setelah daftar dibuat";

  return (
    <main className="min-h-screen bg-[#f8f9fa] text-black">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-12">
        <header className="flex items-center justify-between">
          <button
            onClick={reset}
            className="flex items-center gap-3"
            aria-label="Ke beranda"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9ecef] shadow-lg shadow-black/10">
              <ListChecks size={21} />
            </span>
            <span className="text-lg font-bold tracking-tight">Hadir</span>
          </button>
          {mode !== "home" && (
            <button
              onClick={reset}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black"
            >
              <ArrowLeft size={16} /> Back
            </button>
          )}
        </header>
        <section className="flex flex-1 items-center justify-center py-12">
          {mode === "home" && (
            <div className="w-full max-w-4xl">
              <div className="mb-12 max-w-2xl">
                <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
                  Attendance List
                </h1>
                <p className="mt-3 text-sm text-gray-500">
                  oleh Rachmat Wahid Saleh Insani
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setMode("create")}
                  className="order-2 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-gray-400 hover:shadow-xl"
                >
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f8f9fa] text-gray-700">
                    <Plus size={18} />
                  </span>
                  <span className="block text-base font-bold">Create a list</span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    Start a new list and get a unique ID.
                  </span>
                  <span className="mt-4 block text-xs font-semibold text-gray-700">
                    I am the host →
                  </span>
                </button>
                <button
                  onClick={() => {
                    setMode("host-access");
                    setMessage("");
                  }}
                  className="order-3 rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:border-gray-400 hover:shadow-xl"
                >
                  <span className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-[#f8f9fa] text-gray-700">
                    <LockKeyhole size={18} />
                  </span>
                  <span className="block text-base font-bold">
                    Manage lists
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    Manage all lists with one host password.
                  </span>
                  <span className="mt-4 block text-xs font-semibold text-gray-700">
                    Open host dashboard →
                  </span>
                </button>
                <button
                  onClick={() => {
                    setMode("join");
                    setMessage("");
                  }}
                  className="order-1 rounded-3xl border-2 border-black bg-white p-8 text-left shadow-xl shadow-black/10 transition hover:-translate-y-1 hover:border-gray-700 hover:shadow-2xl sm:col-span-2"
                >
                  <img
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-dMn7yPabzUeKY3v5i1lErYxsfj2i34-eshualed8coqZh0eEbJjYlMFtgMT8v.png"
                    alt="Ilustrasi daftar hadir dengan pensil"
                    className="mb-6 h-20 w-20 rounded-xl object-cover"
                  />
                  <span className="block text-xl font-bold">
                    Record attendance
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-gray-500">
                    Enter the ID and password to check in.
                  </span>
                  <span className="mt-6 block text-sm font-semibold text-gray-700">
                    I am a participant →
                  </span>
                </button>
              </div>
            </div>
          )}
          {mode === "create" && (
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-700">
                  New attendance list
                </p>
                <h2 className="text-4xl font-bold tracking-tight">
                  Create a list
                </h2>
              </div>
              {created ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-700">
                      {created.name}
                    </p>
                    <p className="mt-3 text-sm font-semibold text-gray-700">
                      List ID
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-4xl font-bold tracking-[0.3em]">
                        {created.id}
                      </span>
                      <button
                        onClick={() => copyText(created.id)}
                        className="rounded-lg p-2 text-gray-800 hover:bg-gray-100"
                        aria-label="Salin List ID"
                      >
                        {copied ? <Check size={20} /> : <Clipboard size={20} />}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-sm font-semibold text-gray-700">
                      Participant link
                    </p>
                    <p className="mt-2 break-all text-xs leading-5 text-gray-500">
                      Participants dapat langsung menulis nama melalui tautan ini.
                    </p>
                    <button
                      onClick={() => copyText(shareLink)}
                      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-[#f8f9fa] px-4 text-sm font-semibold text-gray-800 hover:border-gray-400"
                    >
                      <Clipboard size={16} />{" "}
                      {copied ? "Link copied" : "Copy participant link"}
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setMode("host-access");
                      setPassword("");
                      setMessage("");
                    }}
                    className={`${primary} w-full`}
                  >
                    Open host dashboard{" "}
                    <ArrowLeft className="rotate-180" size={17} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="space-y-5">
                  <label className="block text-sm font-semibold">
                    List name
                    <input
                      className={field}
                      value={listName}
                      onChange={(e) =>
                        setListName(e.target.value.toUpperCase().slice(0, 8))
                      }
                      maxLength={8}
                      placeholder="Rapat"
                      required
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    Host password
                    <input
                      className={field}
                      type="password"
                      value={masterPassword}
                      onChange={(e) => setMasterPassword(e.target.value)}
                      placeholder="Enter the host password"
                      required
                    />
                  </label>
                  <label className="block text-sm font-semibold">
                    List password
                    <input
                      className={field}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      minLength={4}
                      required
                    />
                  </label>
                  <button className={`${primary} w-full`} disabled={loading}>
                    {loading ? "Creating…" : "Create a list"} <Plus size={17} />
                  </button>
                </form>
              )}
              {message && (
                <p className="mt-4 text-sm font-medium text-gray-700">
                  {message}
                </p>
              )}
            </div>
          )}
          {mode === "host-access" && (
            <div className="w-full max-w-md">
              <div className="mb-8">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-700">
                  Host dashboard
                </p>
                <h2 className="text-4xl font-bold tracking-tight">
                  Kelola semua daftar
                </h2>
                <p className="mt-3 text-gray-500">
                  Enter the host password untuk melihat dan menghapus daftar.
                </p>
              </div>
              <form onSubmit={handleHost} className="space-y-5">
                <label className="block text-sm font-semibold">
                  Host password
                  <input
                    className={field}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
                <button className={`${primary} w-full`} disabled={loading}>
                  {loading ? "Checking…" : "Buka dasbor"} <Users size={17} />
                </button>
              </form>
              {message && (
                <p className="mt-4 text-sm font-medium text-red-600">
                  {message}
                </p>
              )}
            </div>
          )}
          {mode === "join" && (
            <div
              className={`w-full max-w-md ${duplicateIp ? "[&>*:nth-child(n+3)]:hidden" : ""}`}
            >
              {duplicateIp && (
                <>
                  <img
                    src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-NNCYMFaFanN3dfe9VYG3WkxPzRezVL-MAn7LFyTIYrcjHjFTPLEbGxQkMFls3.png"
                    alt="Ilustrasi perangkat sudah mengisi daftar hadir"
                    className="mx-auto mb-5 h-48 w-48 rounded-2xl object-cover"
                  />
                  <div
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
                    role="alert"
                  >
                    Anda kan sudah mengisi Attendance List {participantListName}{" "}
                    tadi. Lupa ya?
                  </div>
                </>
              )}
              <div className="mb-8">
                <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-700">
                  Akses peserta
                </p>
                <h2 className="text-4xl font-bold tracking-tight">
                  {participantReady || directJoin
                    ? participantListName || "Record attendance"
                    : "Record attendance"}
                </h2>
                {!(participantReady || directJoin) && (
                  <p className="mt-3 text-gray-500">
                    Enter the information shared by the host.
                  </p>
                )}
              </div>
              {error &&
                !duplicateName &&
                ((mode === "join" && participantReady) ||
                  (mode === "join" && directJoin)) && (
                  <div
                    className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
              {message === "Your attendance has been recorded." ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center">
                    <Check className="mx-auto text-gray-700" size={32} />
                    <p className="mt-3 text-lg font-bold">Attendance recorded</p>
                    <p className="mt-1 text-sm text-gray-700">
                      Your name and check-in time have been saved.
                    </p>
                  </div>
                  <button onClick={reset} className={`${primary} w-full`}>
                    Selesai
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={
                    participantReady || directJoin
                      ? handleAttendance
                      : handleJoin
                  }
                  className="space-y-5"
                >
                  {participantReady || directJoin ? (
                    <>
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm ${participantClosed ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-800"}`}
                      >
                        <span
                          className={`font-semibold ${participantClosed ? "text-red-950" : "text-green-950"}`}
                        >
                          {participantClosed
                            ? "This attendance list closed on"
                            : "Attendance List akan ditutup pada"}
                        </span>{" "}
                        {formattedCloseTime}
                      </div>
                      {!participantClosed && (
                        <label className="block text-sm font-semibold">
                          Full name
                          <input
                            className={field}
                            value={name}
                            onChange={(e) =>
                              setName(e.target.value.toUpperCase().slice(0, 32))
                            }
                            maxLength={32}
                            autoFocus
                            required
                          />
                        </label>
                      )}
                      <button
                        className={
                          participantClosed
                            ? "hidden"
                            : duplicateName
                              ? "inline-flex h-12 w-full items-center justify-center rounded-xl bg-red-600 px-5 text-sm font-semibold text-white"
                              : `${primary} w-full`
                        }
                        disabled={loading || participantClosed || duplicateName}
                      >
                        {participantClosed
                          ? "List closed"
                          : loading
                            ? "Menyimpan…"
                            : duplicateName
                              ? "Your name is already on the list"
                              : "Catat saya hadir"}{" "}
                        <Check size={17} />
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="block text-sm font-semibold">
                        List ID
                        <input
                          className={`${field} uppercase tracking-[0.2em]`}
                          maxLength={4}
                          value={listId}
                          onChange={(e) =>
                            setListId(e.target.value.toUpperCase())
                          }
                          placeholder="AB12"
                          required
                        />
                      </label>
                      <label className="block text-sm font-semibold">
                        List password
                        <input
                          className={field}
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </label>
                      <button
                        className={`${primary} w-full`}
                        disabled={loading}
                      >
                        {loading ? "Checking…" : "Continue"}{" "}
                        <ArrowLeft className="rotate-180" size={17} />
                      </button>
                    </>
                  )}
                </form>
              )}
              {error && (
                <p className="mt-4 text-sm font-medium text-red-600">
                  {message}
                </p>
              )}
            </div>
          )}
          {mode === "host" && (
            <div className="w-full max-w-4xl">
              <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-gray-700">
                    Host dashboard
                  </p>
                  <h2 className="text-4xl font-bold tracking-tight">
                    Semua daftar Anda
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setMode("create");
                      setCreated(null);
                      setPassword("");
                      setMessage("");
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-black px-3 text-sm font-semibold text-white hover:bg-gray-800"
                  >
                    <Plus size={16} /> Create a list baru
                  </button>
                  <button
                    onClick={removeSelected}
                    disabled={!selected.length || loading}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 disabled:opacity-40"
                  >
                    <Trash2 size={16} /> Delete selected
                  </button>
                </div>
              </div>
              {message && (
                <p className="mb-4 text-sm font-medium text-gray-700">
                  {message}
                </p>
              )}
              {hostLists.length === 0 ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-5 py-16 text-center text-sm text-gray-500">
                  No attendance lists yet.
                </div>
              ) : selectedList ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500">Detail daftar</p>
                        <h3 className="mt-2 text-2xl font-bold">{selectedList.listName}</h3>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-500">
                          <span>Code: <strong className="font-mono text-gray-900">{selectedList.id}</strong></span>
                          <span>Created: {formatDateTime(selectedList.createdAt)}</span>
                          <span>{selectedList.participants.length} peserta</span>
                        </div>
                      </div>
<div
                          className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${Date.now() >= new Date(selectedList.expiresAt).getTime() ? "border-gray-200 bg-gray-100 text-gray-700" : "border-green-200 bg-green-50 text-green-800"}`}
                          role="status"
                        >
                          {Date.now() >= new Date(selectedList.expiresAt).getTime() ? "DITUTUP" : "AKTIF"}
                        </div>
                    </div>
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold">Participants</h4>
                      <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-medium">
                        <select
                          aria-label="Sort participants"
                          value={participantSort[selectedList.id] ?? "oldest"}
                          onChange={(e) => setParticipantSort((current) => ({ ...current, [selectedList.id]: e.target.value as "az" | "za" | "newest" | "oldest" }))}
                          className="bg-transparent outline-none"
                        >
                          <option value="az">A ke Z</option>
                          <option value="za">Z ke A</option>
                          <option value="newest">Terbaru</option>
                          <option value="oldest">Terlama</option>
                        </select>
                      </label>
                    </div>
                    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                      {[...selectedList.participants].sort((a, b) => {
                        const order = participantSort[selectedList.id] ?? "oldest";
                        if (order === "az" || order === "za") return order === "az" ? a.fullName.localeCompare(b.fullName) : b.fullName.localeCompare(a.fullName);
                        return order === "newest" ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                      }).map((participant) => (
                        <div key={participant.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                          <span className="font-medium">{participant.fullName}</span>
                          <span className="text-xs text-gray-500">{formatDateTime(participant.createdAt)}</span>
                        </div>
                      ))}
                      {selectedList.participants.length === 0 && <p className="px-4 py-6 text-center text-sm text-gray-500">No participants yet.</p>}
                    </div>
                    <button onClick={() => setSelectedList(null)} className="mt-5 text-sm font-semibold text-gray-500 hover:text-black">← Back ke semua daftar</button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {hostLists.map((list) => (
                      <button
                        type="button"
                        onClick={() => openListDetails(list)}
                        key={list.id}
                        aria-label={`Buka detail daftar ${list.listName}`}
                        className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gray-400 hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected.includes(list.id)}
                            aria-label={`Pilih daftar ${list.listName}`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setSelected((current) => e.target.checked ? [...current, list.id] : current.filter((id) => id !== list.id))}
                            className="size-4 shrink-0 accent-black"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate text-base font-bold">{list.listName}</span>
                              <span className={`flex shrink-0 items-center gap-1.5 text-xs font-semibold ${Date.now() >= new Date(list.expiresAt).getTime() ? "text-red-700" : "text-green-700"}`}>
                                {Date.now() >= new Date(list.expiresAt).getTime() ? "CLOSED" : "ACTIVE"}
                                <span aria-hidden="true" className={`size-2 rounded-full ${Date.now() >= new Date(list.expiresAt).getTime() ? "bg-red-500" : "bg-green-500"}`} />
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                              <span className="font-mono">{list.id}</span>
                              <span>{formatDateTime(list.createdAt)}</span>
                              <span className="inline-flex items-center gap-1 font-semibold"><Users size={13} /> {list.participantCount} peserta</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          )}
        </section>
        <footer className="flex items-center justify-center gap-2 pb-2 text-xs text-gray-400">
          <LockKeyhole size={13} /> Privat dengan kata sandi host
        </footer>
      </div>
    </main>
  );
}
