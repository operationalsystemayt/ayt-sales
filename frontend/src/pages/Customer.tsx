import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, MessageCircle, Contact, UserX, UserCheck, UserPlus } from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Avatar from '../components/ui/Avatar'
import EditableCell from '../components/ui/EditableCell'
import { useCanEdit } from '../hooks/useCanEdit'
import { getCustomers, updateCustomer, getContactSummary } from '../services/api'
import type { Customer, ContactSummary } from '../types'

export default function CustomerPage() {
  const navigate = useNavigate()
  const canEdit = useCanEdit()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [summary, setSummary] = useState<ContactSummary | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    const params: Record<string, string> = { saved: 'true' }
    if (search) params.search = search
    const [res, summaryRes] = await Promise.all([getCustomers(params), getContactSummary()])
    setCustomers(res.data)
    setSummary(summaryRes.data)
  }, [search])

  useEffect(() => { load() }, [load])

  const handleUpdate = async (id: string, field: string, value: string) => {
    await updateCustomer(id, { [field]: value })
    load()
  }

  const summaryCards = summary ? [
    { label: 'Total Contact', value: summary.total_contact, icon: Contact, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Active', value: summary.total_active, sub: `${summary.active_days} hari terakhir`, icon: UserCheck, color: 'text-green-600 bg-green-50' },
    { label: 'Total Dormant', value: summary.total_dormant, sub: `> ${summary.dormant_days} hari`, icon: UserX, color: 'text-gray-600 bg-gray-100' },
    { label: 'Total Plain', value: summary.total_plain, sub: 'Leads', icon: UserPlus, color: 'text-purple-600 bg-purple-50' },
  ] : []

  return (
    <Layout title="Contact">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {summaryCards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color} mb-2`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-500 mb-0.5">{label}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4 flex items-center shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / nomor..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-64" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-12">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. HP</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {customers.map((cust) => (
              <tr key={cust.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3"><Avatar name={cust.full_name} /></td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <EditableCell value={cust.full_name} onSave={(v) => handleUpdate(cust.id, 'full_name', v)} disabled={!canEdit} />
                </td>
                <td className="px-4 py-3 text-gray-600">{cust.phone}</td>
                <td className="px-4 py-3 max-w-64">
                  <EditableCell value={cust.notes ?? ''} onSave={(v) => handleUpdate(cust.id, 'notes', v)} disabled={!canEdit} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => navigate(`/chat?customer=${cust.id}`)}
                    title="Go to Chat"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100">
                    <MessageCircle className="w-3.5 h-3.5" /> Go to Chat
                  </button>
                </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Belum ada customer tersimpan</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
