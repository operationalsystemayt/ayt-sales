import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import Layout from '../components/Layout/Layout'
import { getLead, getLeadChats, createLeadChat } from '../services/api'
import type { Lead, Chat as ChatMsg } from '../types'
import { format } from 'date-fns'

export default function Chat() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [lead, setLead] = useState<Lead | null>(null)
  const [chats, setChats] = useState<ChatMsg[]>([])
  const [body, setBody] = useState('')

  const load = useCallback(async () => {
    if (!id) return
    const [leadRes, chatsRes] = await Promise.all([getLead(id), getLeadChats(id)])
    setLead(leadRes.data)
    setChats(chatsRes.data)
  }, [id])

  useEffect(() => { load() }, [load])

  const handleSend = async () => {
    if (!id || !body.trim()) return
    await createLeadChat(id, { direction: 'out', body: body.trim() })
    setBody('')
    load()
  }

  return (
    <Layout title={`Chat${lead?.customer?.full_name ? ` — ${lead.customer.full_name}` : ''}`}>
      <button onClick={() => navigate('/leads')} className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Leads
      </button>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3 max-w-2xl">
        {lead && (
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">{lead.customer?.full_name}</p>
              <p className="text-xs text-gray-500">{lead.customer?.phone}</p>
            </div>
            {lead.status && <span className="text-xs text-gray-400">{lead.status.name}</span>}
          </div>
        )}
        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto py-2">
          {chats.map((c) => (
            <div key={c.id} className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${c.direction === 'in' ? 'self-start bg-gray-100 text-gray-800' : 'self-end bg-blue-600 text-white'}`}>
              <p className="whitespace-pre-wrap">{c.body}</p>
              <span className="block text-[10px] opacity-70 mt-1">{format(new Date(c.chat_timestamp), 'dd MMM HH:mm')}</span>
            </div>
          ))}
          {chats.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Belum ada percakapan</p>}
        </div>
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tulis pesan..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }}
          />
          <button onClick={handleSend} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">Kirim</button>
        </div>
      </div>
    </Layout>
  )
}
