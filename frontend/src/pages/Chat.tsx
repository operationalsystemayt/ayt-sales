import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Search, Download, Archive, ArchiveRestore, UserPlus, MoreVertical, Star,
  Mail, MapPin, Send, Smile, Paperclip, Trash2, MessageCircleOff, RefreshCw,
} from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import EditableCell from '../components/ui/EditableCell'
import {
  getChatInbox, getChatSummary, getLeadChats, createLeadChat, markChatRead, syncLeadChats,
  archiveLead, unarchiveLead, getLeadActivities, createLeadActivity, updateCustomer,
  saveCustomer, getCustomerSummary, getUsers, getMasterStatuses, getMasterSources,
  updateLead, deleteLead,
} from '../services/api'
import { useAuthStore } from '../store/auth'
import type {
  ChatInboxItem, ChatSummary, Chat as ChatMsg, User, MasterStatus, MasterSource,
  LeadActivity, CustomerSummary,
} from '../types'
import { format, isToday, isYesterday } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const SOURCE_ICON: Record<string, string> = { Ads: '📢', Organik: '🌱', Referensi: '🤝', Offline: '🏢' }

const fmtListTime = (d?: string) => {
  if (!d) return ''
  const dt = new Date(d)
  if (isToday(dt)) return format(dt, 'HH:mm')
  if (isYesterday(dt)) return 'Kemarin'
  return format(dt, 'd MMM', { locale: idLocale })
}
const fmtBubbleTime = (d?: string) => (d ? format(new Date(d), 'dd MMM HH:mm') : '')
const fmtRp = (n?: number) => n !== undefined && n !== null ? `Rp ${n.toLocaleString('id-ID')}` : '-'

type ListFilter = 'all' | 'unread' | 'archived'
type ThreadTab = 'chat' | 'riwayat' | 'catatan' | 'file'
type ReplyMode = 'balas' | 'internal'

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex-1 min-w-[140px]">
      <p className={`text-xs font-medium mb-1 ${color}`}>{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Chat() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user: currentUser } = useAuthStore()
  const isSales = currentUser?.role === 'sales'

  const [items, setItems] = useState<ChatInboxItem[]>([])
  const [summary, setSummary] = useState<ChatSummary | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [salesFilter, setSalesFilter] = useState('')
  const [search, setSearch] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [statuses, setStatuses] = useState<MasterStatus[]>([])
  const [sources, setSources] = useState<MasterSource[]>([])

  const [chats, setChats] = useState<ChatMsg[]>([])
  const [activities, setActivities] = useState<LeadActivity[]>([])
  const [custSummary, setCustSummary] = useState<CustomerSummary | null>(null)
  const [threadTab, setThreadTab] = useState<ThreadTab>('chat')
  const [replyMode, setReplyMode] = useState<ReplyMode>('balas')
  const [body, setBody] = useState('')
  const [sendError, setSendError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [notesDraft, setNotesDraft] = useState('')

  const loadInbox = useCallback(async () => {
    const params: Record<string, string> = {}
    if (salesFilter) params.sales_id = salesFilter
    if (statusFilter) params.status_id = statusFilter
    if (listFilter === 'archived') params.archived = 'true'
    const [inboxRes, summaryRes] = await Promise.all([getChatInbox(params), getChatSummary(params)])
    setItems(inboxRes.data)
    setSummary(summaryRes.data)
  }, [salesFilter, statusFilter, listFilter])

  useEffect(() => { loadInbox() }, [loadInbox])
  useEffect(() => {
    Promise.all([getUsers(), getMasterStatuses(), getMasterSources()]).then(([u, s, src]) => {
      setUsers(u.data); setStatuses(s.data); setSources(src.data)
    })
  }, [])

  // Deep-link support: /chat?lead=<id> or /chat?customer=<id> always win over the
  // "select first conversation" default — combined into one effect so they can't
  // race and stomp on each other's setSelectedId call within the same commit.
  const leadParam = searchParams.get('lead')
  const customerParam = searchParams.get('customer')
  useEffect(() => {
    if (leadParam) { setSelectedId(leadParam); return }
    if (customerParam) {
      const match = items.find((it) => it.customer_id === customerParam)
      if (match) setSelectedId(match.id)
      return
    }
    if (!selectedId && items.length > 0) setSelectedId(items[0].id)
  }, [leadParam, customerParam, items, selectedId])

  const selected = items.find((it) => it.id === selectedId) ?? null

  const loadThread = useCallback(async (leadId: string) => {
    const [chatsRes, actRes] = await Promise.all([getLeadChats(leadId), getLeadActivities(leadId)])
    setChats(chatsRes.data)
    setActivities(actRes.data)
    markChatRead(leadId).catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedId) loadThread(selectedId)
  }, [selectedId, loadThread])

  useEffect(() => {
    if (selected) setNotesDraft(selected.notes ?? '')
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selected?.customer_id) {
      getCustomerSummary(selected.customer_id).then((res) => setCustSummary(res.data)).catch(() => setCustSummary(null))
    } else {
      setCustSummary(null)
    }
  }, [selected?.customer_id])

  const handleSend = async () => {
    if (!selected || !body.trim()) return
    setSendError('')
    if (replyMode === 'internal') {
      await createLeadActivity(selected.id, { activity: 'Catatan Internal', notes: body.trim() })
      const actRes = await getLeadActivities(selected.id)
      setActivities(actRes.data)
    } else {
      const res = await createLeadChat(selected.id, { direction: 'out', body: body.trim() })
      if (res.data.send_error) setSendError(res.data.send_error)
      const chatsRes = await getLeadChats(selected.id)
      setChats(chatsRes.data)
    }
    setBody('')
    loadInbox()
  }

  const handleArchiveToggle = async () => {
    if (!selected) return
    if (selected.is_archived) await unarchiveLead(selected.id)
    else await archiveLead(selected.id)
    setMenuOpen(false)
    loadInbox()
  }

  const handleSaveCustomer = async () => {
    if (!selected) return
    await saveCustomer(selected.customer_id)
    setMenuOpen(false)
    setSavedMsg('Customer tersimpan')
    setTimeout(() => setSavedMsg(''), 2500)
  }

  const handleDeleteLead = async () => {
    if (!selected) return
    if (!confirm('Hapus lead ini?')) return
    await deleteLead(selected.id)
    setMenuOpen(false)
    setSelectedId(null)
    loadInbox()
  }

  const handleToggleFavorite = async () => {
    if (!selected?.customer) return
    await updateCustomer(selected.customer_id, { is_favorite: !selected.customer.is_favorite })
    loadInbox()
  }

  const handleRenameCustomer = async (name: string) => {
    if (!selected) return
    await updateCustomer(selected.customer_id, { full_name: name })
    loadInbox()
  }

  const handleSaveNotes = async () => {
    if (!selected) return
    await updateLead(selected.id, { notes: notesDraft })
    loadInbox()
  }

  const handleSync = async () => {
    if (!selected) return
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await syncLeadChats(selected.id)
      setSyncMsg(`Sinkron ${res.data.synced} pesan`)
      loadThread(selected.id)
    } catch (err: any) {
      setSyncMsg(err.response?.data?.error ?? 'Gagal sync riwayat chat')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMsg(''), 3000)
    }
  }

  const handleExportCsv = () => {
    const header = ['Nama', 'No HP', 'Status', 'Pesan Terakhir', 'Waktu']
    const rows = filteredItems.map((it) => [
      it.customer?.full_name ?? '', it.customer?.phone ?? '', it.status?.name ?? '',
      (it.last_message?.body ?? '').replace(/\n/g, ' '), it.last_chat_at ?? '',
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredItems = useMemo(() => {
    let list = items
    if (listFilter === 'unread') list = list.filter((it) => it.unread_count > 0)
    if (sourceFilter) list = list.filter((it) => String(it.source_id ?? '') === sourceFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter((it) =>
        it.customer?.full_name?.toLowerCase().includes(s) ||
        it.customer?.phone?.includes(s) ||
        it.last_message?.body?.toLowerCase().includes(s)
      )
    }
    return list
  }, [items, listFilter, sourceFilter, search])

  const unreadTotal = items.reduce((sum, it) => sum + (it.unread_count > 0 ? 1 : 0), 0)
  const archivedTotal = items.filter((it) => it.is_archived).length

  return (
    <Layout title="Chat">
      {/* Summary row */}
      <div className="flex flex-wrap gap-4 mb-4">
        <StatCard label="Semua Chat" value={summary?.total ?? 0} sub="Total percakapan" color="text-blue-600" />
        <StatCard label="Need Response" value={summary?.need_response ?? 0} sub="Butuh dibalas" color="text-red-600" />
        <StatCard label="Waiting Customer" value={summary?.waiting_customer ?? 0} sub="Menunggu customer" color="text-orange-500" />
        <StatCard label="Dormant" value={summary?.dormant ?? 0} sub="Tidak ada aktivitas" color="text-gray-500" />
        <StatCard label="Selesai Hari Ini" value={summary?.selesai_hari_ini ?? 0} sub="Selesai" color="text-green-600" />
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-medium text-gray-600 mb-2">SLA Response</p>
          <div className="flex gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt;30m {summary?.sla_buckets.over_30m ?? 0}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> 15-30m {summary?.sla_buckets['15_30m'] ?? 0}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400" /> 5-15m {summary?.sla_buckets['5_15m'] ?? 0}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> &lt;5m {summary?.sla_buckets.under_5m ?? 0}</span>
          </div>
        </div>
        <button onClick={handleExportCsv} className="flex items-center gap-1.5 bg-white border border-gray-100 shadow-sm rounded-2xl px-4 text-sm font-medium text-gray-600 hover:bg-gray-50">
          <Download className="w-4 h-4" /> Ekspor Data
        </button>
      </div>

      {/* Filters row */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center shadow-sm">
        {!isSales && (
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={salesFilter} onChange={(e) => setSalesFilter(e.target.value)}>
            <option value="">Semua Sales</option>
            {users.filter((u) => u.role === 'sales').map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        )}
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Semua Status</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">Semua Kanal</option>
          {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* 3-column inbox */}
      <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 260px)', minHeight: 500 }}>
        {/* Conversation list */}
        <div className="col-span-12 lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800 mb-2">Semua Percakapan ({filteredItems.length})</p>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / nomor..."
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>
            <div className="flex gap-1 mt-2">
              {(['all', 'unread', 'archived'] as ListFilter[]).map((f) => (
                <button key={f} onClick={() => setListFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${listFilter === f ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {f === 'all' ? 'Semua' : f === 'unread' ? `Belum Dibaca (${unreadTotal})` : `Diarsipkan (${archivedTotal})`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredItems.map((it) => (
              <button key={it.id} onClick={() => { setSelectedId(it.id); setThreadTab('chat') }}
                className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedId === it.id ? 'bg-blue-50/60' : ''}`}>
                <div className="flex gap-2">
                  <Avatar name={it.customer?.full_name ?? '-'} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900 truncate flex items-center gap-1">
                        {it.customer?.full_name ?? '-'}
                        {it.source?.name && <span title={it.source.name}>{SOURCE_ICON[it.source.name] ?? ''}</span>}
                      </span>
                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-1">{fmtListTime(it.last_chat_at)}</span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{it.product?.product_name ? `Lead (${it.product.product_name})` : it.lead_no}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-500 truncate max-w-[70%]">{it.last_message?.body ?? '-'}</p>
                      <div className="flex items-center gap-1">
                        {it.status && <Badge label={it.status.name} type="status" />}
                        {it.unread_count > 0 && (
                          <span className="w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] rounded-full">{it.unread_count}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filteredItems.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Tidak ada percakapan</p>}
          </div>
        </div>

        {/* Thread panel */}
        <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <MessageCircleOff className="w-5 h-5 mr-2" /> Pilih percakapan
            </div>
          ) : (
            <>
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <EditableCell value={selected.customer?.full_name ?? ''} onSave={handleRenameCustomer} />
                  <p className="text-xs text-gray-500">{selected.customer?.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  {custSummary?.active_booking && (
                    <button onClick={() => navigate('/booking')} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
                      Lihat Booking
                    </button>
                  )}
                  <button onClick={handleSync} disabled={syncing} title="Sync Riwayat" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  </button>
                  <div className="relative">
                    <button onClick={() => setMenuOpen((o) => !o)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg z-10 py-1">
                        <button onClick={handleArchiveToggle} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                          {selected.is_archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                          {selected.is_archived ? 'Buka Arsip' : 'Arsipkan'}
                        </button>
                        <button onClick={handleSaveCustomer} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                          <UserPlus className="w-3.5 h-3.5" /> Simpan Customer
                        </button>
                        <button onClick={handleDeleteLead} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" /> Hapus Lead
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {savedMsg && <div className="mx-4 mt-2 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-1.5">{savedMsg}</div>}
              {syncMsg && <div className="mx-4 mt-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-xs rounded-lg px-3 py-1.5">{syncMsg}</div>}

              <div className="flex border-b border-gray-100 px-4">
                {(['chat', 'riwayat', 'catatan', 'file'] as ThreadTab[]).map((t) => (
                  <button key={t} onClick={() => setThreadTab(t)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${threadTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {t === 'chat' ? 'Chat' : t === 'riwayat' ? 'Riwayat' : t === 'catatan' ? 'Catatan' : 'File'}
                  </button>
                ))}
              </div>

              {threadTab === 'chat' && (
                <>
                  <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                    {chats.map((c) => (
                      <div key={c.id} className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${c.direction === 'in' ? 'self-start bg-gray-100 text-gray-800' : 'self-end bg-blue-600 text-white'}`}>
                        <p className={`whitespace-pre-wrap ${!c.body ? 'italic opacity-60' : ''}`}>{c.body || '📎 Media (belum didukung)'}</p>
                        <span className="block text-[10px] opacity-70 mt-1">{fmtBubbleTime(c.chat_timestamp)}</span>
                      </div>
                    ))}
                    {chats.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Belum ada percakapan</p>}
                  </div>
                  <div className="border-t border-gray-100 p-3">
                    {sendError && (
                      <div className="mb-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
                        Pesan tersimpan, tapi gagal terkirim: {sendError}
                      </div>
                    )}
                    <div className="flex gap-1 mb-2">
                      {(['balas', 'internal'] as ReplyMode[]).map((m) => (
                        <button key={m} onClick={() => setReplyMode(m)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${replyMode === m ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                          {m === 'balas' ? 'Balas' : 'Catatan Internal'}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-end gap-2">
                      <button disabled title="Segera hadir" className="p-2 text-gray-300 rounded-lg cursor-not-allowed"><Smile className="w-4 h-4" /></button>
                      <button disabled title="Segera hadir" className="p-2 text-gray-300 rounded-lg cursor-not-allowed"><Paperclip className="w-4 h-4" /></button>
                      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={1}
                        placeholder={replyMode === 'balas' ? 'Ketik pesan...' : 'Tulis catatan internal (tidak terkirim ke WhatsApp)...'}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }} />
                      <button onClick={handleSend} className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">Dikirim dari WhatsApp ({selected.customer?.phone})</p>
                  </div>
                </>
              )}

              {threadTab === 'riwayat' && (
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {activities.map((a) => (
                    <div key={a.id} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm font-medium text-gray-800">{a.activity}</p>
                      {a.notes && <p className="text-xs text-gray-600 mt-0.5">{a.notes}</p>}
                      <p className="text-[10px] text-gray-400 mt-1">{a.creator?.full_name ?? 'Sistem'} · {fmtBubbleTime(a.created_at)}</p>
                    </div>
                  ))}
                  {activities.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Belum ada riwayat</p>}
                </div>
              )}

              {threadTab === 'catatan' && (
                <div className="flex-1 overflow-y-auto p-4">
                  <textarea value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} rows={8}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                    placeholder="Catatan untuk lead ini..." />
                  <button onClick={handleSaveNotes} className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">
                    Simpan Catatan
                  </button>
                </div>
              )}

              {threadTab === 'file' && (
                <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Fitur file segera hadir</div>
              )}
            </>
          )}
        </div>

        {/* Info panel */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4 overflow-y-auto">
          {selected && (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Info Customer</p>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={selected.customer?.full_name ?? '-'} size="md" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-gray-900">{selected.customer?.full_name}</span>
                      <button onClick={handleToggleFavorite}>
                        <Star className={`w-3.5 h-3.5 ${selected.customer?.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                      </button>
                    </div>
                    <a href={`https://wa.me/${selected.customer?.phone}`} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline">
                      {selected.customer?.phone}
                    </a>
                  </div>
                </div>
                {selected.customer?.email && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5 mb-1"><Mail className="w-3 h-3" /> {selected.customer.email}</p>
                )}
                {selected.customer?.address && (
                  <p className="text-xs text-gray-500 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {selected.customer.address}</p>
                )}
                <button onClick={() => navigate('/contact')} className="w-full mt-3 text-xs py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 font-medium">
                  Lihat Profil Customer
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Ringkasan Hubungan</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Lead Terakhir</span><span className="font-medium text-gray-700">{custSummary?.recent_lead?.lead_no ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Hasil</span><span className="font-medium text-gray-700">{custSummary?.recent_lead?.result?.name ?? '-'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Total Booking</span><span className="font-medium text-gray-700">{custSummary?.total_bookings ?? 0} kali</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Total Belanja</span><span className="font-medium text-gray-700">{fmtRp(custSummary?.total_spent)}</span></div>
                </div>
              </div>

              {custSummary?.active_booking && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Booking Aktif</p>
                  <p className="text-sm font-bold text-blue-600 mb-2">{custSummary.active_booking.booking_no}</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-gray-400">Paket</span><span className="font-medium text-gray-700">{custSummary.active_booking.product?.product_name ?? '-'}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Pax</span><span className="font-medium text-gray-700">{custSummary.active_booking.pax}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Total</span><span className="font-medium text-gray-700">{fmtRp(custSummary.active_booking.total_price)}</span></div>
                  </div>
                </div>
              )}

              {custSummary?.latest_note && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Catatan Terakhir</p>
                  <p className="text-xs text-gray-600">{custSummary.latest_note.notes || custSummary.latest_note.activity}</p>
                  <p className="text-[10px] text-gray-400 mt-2">Oleh {custSummary.latest_note.creator?.full_name ?? 'Sistem'} · {fmtBubbleTime(custSummary.latest_note.created_at)}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Legend strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-xs text-gray-500">
        <div>
          <p className="font-semibold text-gray-700 mb-1.5">Status Response (Komunikasi)</p>
          <p><span className="text-red-600 font-medium">Need Response</span>: Customer terakhir chat, tim belum membalas</p>
          <p><span className="text-orange-500 font-medium">Waiting Customer</span>: Tim sudah membalas, menunggu customer</p>
          <p><span className="text-gray-500 font-medium">Dormant</span>: Tidak ada aktivitas dalam periode tertentu</p>
        </div>
        <div>
          <p className="font-semibold text-gray-700 mb-1.5">SLA Response Time</p>
          <p><span className="text-red-600 font-medium">&gt;30 menit</span>: Overdue (perlu segera dibalas)</p>
          <p><span className="text-orange-500 font-medium">15-30 menit</span>: Resiko lambat</p>
          <p><span className="text-yellow-500 font-medium">5-15 menit</span>: Cukup baik</p>
          <p><span className="text-green-600 font-medium">&lt;5 menit</span>: Sangat baik</p>
        </div>
        <div>
          <p className="font-semibold text-gray-700 mb-1.5">Kanal Sumber Chat</p>
          {sources.map((s) => <p key={s.id}>{SOURCE_ICON[s.name] ?? '💬'} {s.name}</p>)}
        </div>
        <div>
          <p className="font-semibold text-gray-700 mb-1.5">Fitur Utama Page Chat</p>
          <p>✅ Filter lengkap berdasarkan status, sales, kanal</p>
          <p>✅ Unread &amp; archive percakapan</p>
          <p>✅ Ringkasan hubungan &amp; booking aktif</p>
          <p>✅ Catatan internal &amp; riwayat aktivitas</p>
        </div>
      </div>
    </Layout>
  )
}
