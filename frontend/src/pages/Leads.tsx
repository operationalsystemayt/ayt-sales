import { useEffect, useState, useCallback } from 'react'
import { Plus, RotateCcw, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import {
  getLeads, createLead, updateLead, deleteLead, bulkUpdateLeads,
  convertLeadToBooking, getUsers, getMasterSources, getMasterInputs,
  getMasterQualities, getMasterStatuses, getMasterResults, getProducts, getProductGroups
} from '../services/api'
import type {
  Lead, User, MasterSource, MasterInput, MasterQuality,
  MasterStatus, MasterResult, Product, ProductGroup
} from '../types'
import { format } from 'date-fns'

const fmtDate = (d?: string) => d ? format(new Date(d), 'dd MMM yyyy') : '-'
const fmtNum = (n?: number) => n !== undefined && n !== null ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} jt` : '-'
const BOOKING_STATUSES = ['Waiting Payment 1','Waiting Payment 2','Waiting Payment 3','Waiting DP','Waiting Passport','Waiting Visa','Ticketing','Ready to Depart','Completed','Cancelled']
const BULK_FIELDS = ['source_id','quality_id','result_id','product_id','group_id','status_id']

const PAGE_SIZE = 20

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ sales_id: '', status_id: '', quality_id: '', result_id: '', product_id: '' })
  const [selected, setSelected] = useState<string[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showConvert, setShowConvert] = useState<Lead | null>(null)

  // master data
  const [users, setUsers] = useState<User[]>([])
  const [sources, setSources] = useState<MasterSource[]>([])
  const [inputs, setInputs] = useState<MasterInput[]>([])
  const [qualities, setQualities] = useState<MasterQuality[]>([])
  const [statuses, setStatuses] = useState<MasterStatus[]>([])
  const [results, setResults] = useState<MasterResult[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [groups, setGroups] = useState<ProductGroup[]>([])

  // add form
  const [form, setForm] = useState({
    sales_id: '', customer_name: '', phone: '', date_received: '',
    source_id: '', input_id: '', quality_id: '', status_id: '', result_id: '',
    product_id: '', group_id: '', price: '', pax: ''
  })

  // convert form
  const [convertForm, setConvertForm] = useState({
    product_id: '', group_id: '', departure_date: '', price_per_pax: '', pax: '1', booking_status: 'Waiting Payment 1'
  })
  const [convertResult, setConvertResult] = useState<{ booking_no: string } | null>(null)

  // bulk
  const [bulkField, setBulkField] = useState('quality_id')
  const [bulkValue, setBulkValue] = useState('')

  const loadMasters = useCallback(async () => {
    const [u, s, i, q, st, r, p, g] = await Promise.all([
      getUsers(), getMasterSources(), getMasterInputs(), getMasterQualities(),
      getMasterStatuses(), getMasterResults(), getProducts(), getProductGroups()
    ])
    setUsers(u.data); setSources(s.data); setInputs(i.data); setQualities(q.data)
    setStatuses(st.data); setResults(r.data); setProducts(p.data); setGroups(g.data)
  }, [])

  const loadLeads = useCallback(async () => {
    const params: Record<string, string> = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    const res = await getLeads(params)
    setLeads(res.data)
    setSelected([])
  }, [filters])

  useEffect(() => { loadMasters() }, [loadMasters])
  useEffect(() => { loadLeads() }, [loadLeads])

  const pagedLeads = leads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(leads.length / PAGE_SIZE)

  const toggleSelect = (id: string) =>
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const toggleAll = () =>
    setSelected(selected.length === pagedLeads.length ? [] : pagedLeads.map((l) => l.id))

  const handleInlineUpdate = async (id: string, field: string, value: string | number | null) => {
    await updateLead(id, { [field]: value })
    loadLeads()
  }

  const handleAddLead = async () => {
    await createLead({
      ...form,
      source_id: form.source_id ? Number(form.source_id) : undefined,
      input_id: form.input_id ? Number(form.input_id) : undefined,
      quality_id: form.quality_id ? Number(form.quality_id) : undefined,
      status_id: form.status_id ? Number(form.status_id) : undefined,
      result_id: form.result_id ? Number(form.result_id) : undefined,
      product_id: form.product_id ? Number(form.product_id) : undefined,
      group_id: form.group_id ? Number(form.group_id) : undefined,
      price: form.price ? Number(form.price) * 1_000_000 : undefined,
      pax: form.pax ? Number(form.pax) : undefined,
    })
    setShowAdd(false)
    setForm({ sales_id:'', customer_name:'', phone:'', date_received:'', source_id:'', input_id:'', quality_id:'', status_id:'', result_id:'', product_id:'', group_id:'', price:'', pax:'' })
    loadLeads()
  }

  const handleConvert = async () => {
    if (!showConvert) return
    const res = await convertLeadToBooking(showConvert.id, {
      product_id: Number(convertForm.product_id),
      group_id: Number(convertForm.group_id),
      departure_date: convertForm.departure_date,
      price_per_pax: Number(convertForm.price_per_pax) * 1_000_000,
      pax: Number(convertForm.pax),
      booking_status: convertForm.booking_status,
    })
    setConvertResult({ booking_no: res.data.booking_no })
    loadLeads()
  }

  const handleBulkUpdate = async () => {
    if (!selected.length || !bulkValue) return
    await bulkUpdateLeads({ ids: selected, field: bulkField, value: Number(bulkValue) })
    setSelected([])
    loadLeads()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus lead ini?')) return
    await deleteLead(id)
    loadLeads()
  }

  const getBulkOptions = () => {
    switch (bulkField) {
      case 'source_id': return sources.map((x) => ({ id: x.id, name: x.name }))
      case 'quality_id': return qualities.map((x) => ({ id: x.id, name: x.name }))
      case 'result_id': return results.map((x) => ({ id: x.id, name: x.name }))
      case 'product_id': return products.map((x) => ({ id: x.id, name: x.product_name }))
      case 'group_id': return groups.map((x) => ({ id: x.id, name: x.name }))
      case 'status_id': return statuses.map((x) => ({ id: x.id, name: x.name }))
      default: return []
    }
  }

  return (
    <Layout title="Leads & Deals">
      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center shadow-sm">
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.sales_id} onChange={(e) => { setFilters({ ...filters, sales_id: e.target.value }); setPage(1) }}>
          <option value="">Sales: Semua</option>
          {users.filter((u) => u.role === 'sales').map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.status_id} onChange={(e) => { setFilters({ ...filters, status_id: e.target.value }); setPage(1) }}>
          <option value="">Status: Semua</option>
          {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.quality_id} onChange={(e) => { setFilters({ ...filters, quality_id: e.target.value }); setPage(1) }}>
          <option value="">Kualitas: Semua</option>
          {qualities.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.result_id} onChange={(e) => { setFilters({ ...filters, result_id: e.target.value }); setPage(1) }}>
          <option value="">Hasil: Semua</option>
          {results.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.product_id} onChange={(e) => { setFilters({ ...filters, product_id: e.target.value }); setPage(1) }}>
          <option value="">Produk: Semua</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.product_name}</option>)}
        </select>
        <button onClick={() => { setFilters({ sales_id:'', status_id:'', quality_id:'', result_id:'', product_id:'' }); setPage(1) }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Tambah Data
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-3 text-left w-8">
                  <input type="checkbox" checked={selected.length === pagedLeads.length && pagedLeads.length > 0} onChange={toggleAll} className="rounded" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">No.</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Masuk</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. HP</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sumber</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Input</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kualitas</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hasil</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Deal</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grup</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Harga</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pax</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Jml Harga</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedLeads.map((lead, idx) => (
                <tr key={lead.id} className={`hover:bg-gray-50/50 transition-colors ${selected.includes(lead.id) ? 'bg-blue-50/30' : ''}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-3 text-gray-500">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td className="px-3 py-3">
                    {lead.sales ? <Avatar name={lead.sales.full_name} src={lead.sales.avatar} /> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{fmtDate(lead.date_received)}</td>
                  <td className="px-3 py-3 font-medium text-gray-700">{lead.customer?.phone ?? '-'}</td>
                  <td className="px-3 py-3 font-semibold text-gray-900">{lead.customer?.full_name ?? '-'}</td>
                  {/* Inline dropdowns */}
                  <td className="px-3 py-3">
                    <select className="text-xs border-0 bg-transparent focus:outline-none text-gray-600 cursor-pointer"
                      value={lead.source_id ?? ''}
                      onChange={(e) => handleInlineUpdate(lead.id, 'source_id', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">-</option>
                      {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select className="text-xs border-0 bg-transparent focus:outline-none text-gray-600 cursor-pointer"
                      value={lead.input_id ?? ''}
                      onChange={(e) => handleInlineUpdate(lead.id, 'input_id', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">-</option>
                      {inputs.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    {lead.quality ? <Badge label={lead.quality.name} type="quality" /> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-3">
                    {lead.status ? <Badge label={lead.status.name} type="status" /> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-3">
                    <select className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer"
                      value={lead.result_id ?? ''}
                      onChange={(e) => handleInlineUpdate(lead.id, 'result_id', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">-</option>
                      {results.map((r) => <option key={r.id} value={r.id}
                        className={r.name === 'Deal' ? 'text-green-600' : r.name === 'Cancel' ? 'text-red-600' : ''}>
                        {r.name}
                      </option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-xs">
                    {lead.result?.name === 'Deal' ? (
                      <span className="text-green-600 font-semibold">{fmtDate(lead.deal_date)}</span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-3">
                    <select className="text-xs border-0 bg-transparent focus:outline-none text-gray-600 cursor-pointer max-w-24"
                      value={lead.product_id ?? ''}
                      onChange={(e) => handleInlineUpdate(lead.id, 'product_id', e.target.value ? Number(e.target.value) : null)}>
                      <option value="">-</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.country?.name ?? p.product_name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    {lead.group ? <Badge label={lead.group.name} type="group" /> : <span className="text-gray-300">-</span>}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">{fmtNum(lead.price)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{lead.pax ?? '-'}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">{fmtNum(lead.total_price)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button title="Convert ke Booking" onClick={() => { setShowConvert(lead); setConvertResult(null); setConvertForm({ product_id: String(lead.product_id ?? ''), group_id: '', departure_date: '', price_per_pax: lead.price ? String(lead.price / 1_000_000) : '', pax: String(lead.pax ?? 1), booking_status: 'Waiting Payment 1' }) }}
                        className="p-1 rounded-lg hover:bg-yellow-100 text-yellow-600 transition">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button title="Hapus" onClick={() => handleDelete(lead.id)}
                        className="p-1 rounded-lg hover:bg-red-100 text-red-500 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {pagedLeads.length === 0 && (
                <tr><td colSpan={18} className="text-center py-12 text-gray-400">Tidak ada data lead</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Menampilkan {Math.min((page - 1) * PAGE_SIZE + 1, leads.length)}–{Math.min(page * PAGE_SIZE, leads.length)} dari {leads.length} data
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium ${p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bulk edit bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-2xl border border-gray-200 px-6 py-4 flex items-center gap-4 z-40 min-w-max">
          <span className="text-sm font-semibold text-gray-800">{selected.length} data dipilih</span>
          <span className="text-sm text-gray-500">Ubah</span>
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={bulkField} onChange={(e) => { setBulkField(e.target.value); setBulkValue('') }}>
            {BULK_FIELDS.map((f) => <option key={f} value={f}>{f.replace('_id','').charAt(0).toUpperCase()+f.replace('_id','').slice(1)}</option>)}
          </select>
          <span className="text-sm text-gray-500">Menjadi</span>
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)}>
            <option value="">Pilih...</option>
            {getBulkOptions().map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button onClick={() => setSelected([])} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100">Batal</button>
          <button onClick={handleBulkUpdate} className="bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 font-medium">Terapkan</button>
        </div>
      )}

      {/* Add Lead Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Data Lead" size="lg">
        <div className="p-6 grid grid-cols-2 gap-4">
          {[
            { label: 'Sales *', key: 'sales_id', type: 'select', options: users.filter(u=>u.role==='sales').map(u=>({id:u.id,name:u.full_name})) },
            { label: 'Tanggal Masuk *', key: 'date_received', type: 'date' },
            { label: 'No. HP *', key: 'phone', type: 'text', placeholder: '0812-3456-7890' },
            { label: 'Nama Customer *', key: 'customer_name', type: 'text', placeholder: 'Masukkan nama customer' },
            { label: 'Sumber *', key: 'source_id', type: 'select', options: sources.map(s=>({id:s.id,name:s.name})) },
            { label: 'Input *', key: 'input_id', type: 'select', options: inputs.map(i=>({id:i.id,name:i.name})) },
            { label: 'Kualitas *', key: 'quality_id', type: 'select', options: qualities.map(q=>({id:q.id,name:q.name})) },
            { label: 'Status', key: 'status_id', type: 'select', options: statuses.map(s=>({id:s.id,name:s.name})) },
            { label: 'Hasil', key: 'result_id', type: 'select', options: results.map(r=>({id:r.id,name:r.name})) },
            { label: 'Produk', key: 'product_id', type: 'select', options: products.map(p=>({id:p.id,name:p.product_name})) },
            { label: 'Grup', key: 'group_id', type: 'select', options: groups.map(g=>({id:g.id,name:g.name})) },
            { label: 'Harga (jt)', key: 'price', type: 'number', placeholder: 'Contoh: 14.9' },
            { label: 'Jumlah Pax', key: 'pax', type: 'number', placeholder: 'Contoh: 2' },
          ].map(({ label, key, type, options, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              {type === 'select' ? (
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={(form as Record<string,string>)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                  <option value="">Pilih...</option>
                  {(options as {id:number|string;name:string}[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <input type={type} placeholder={placeholder} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={(form as Record<string,string>)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Jumlah Harga</label>
            <input readOnly className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-500"
              value={form.price && form.pax ? `${(Number(form.price) * Number(form.pax)).toFixed(1)} jt` : 'Akan terhitung otomatis'} />
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
          <button onClick={handleAddLead} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">Simpan Data</button>
        </div>
      </Modal>

      {/* Convert Modal */}
      <Modal open={!!showConvert} onClose={() => { setShowConvert(null); setConvertResult(null) }} title="Convert Lead to Booking" size="md">
        {convertResult ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Booking Berhasil Dibuat!</h3>
            <p className="text-sm text-gray-500 mb-1">No. Booking</p>
            <p className="text-xl font-bold text-blue-600 mb-6">{convertResult.booking_no}</p>
            <div className="bg-green-50 rounded-xl p-4 text-left space-y-2 mb-6">
              {['Booking baru dibuat','Lead status menjadi Converted','Lead tidak tampil di Leads aktif','Booking muncul di menu Booking','Customer tetap menggunakan data yang sama'].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm text-green-700">
                  <span>✅</span> {t}
                </div>
              ))}
            </div>
            <button onClick={() => { setShowConvert(null); setConvertResult(null) }} className="w-full py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium">Tutup</button>
          </div>
        ) : showConvert && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4 bg-gray-50 rounded-xl p-4 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Customer</p>
                <p className="font-semibold text-gray-800">{showConvert.customer?.full_name}</p>
                <p className="text-gray-500">{showConvert.customer?.phone}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Sumber Lead</p>
                <p className="font-medium text-gray-700">{showConvert.source?.name ?? '-'}</p>
              </div>
            </div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Informasi Booking</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Produk *', key: 'product_id', type: 'select', options: products.map(p=>({id:p.id,name:p.product_name})) },
                { label: 'Grup', key: 'group_id', type: 'select', options: groups.map(g=>({id:g.id,name:g.name})) },
                { label: 'Keberangkatan *', key: 'departure_date', type: 'date' },
                { label: 'Harga per Pax (jt) *', key: 'price_per_pax', type: 'number', placeholder: '14.9' },
                { label: 'Jumlah Pax *', key: 'pax', type: 'number', placeholder: '2' },
                { label: 'Status Booking Awal', key: 'booking_status', type: 'select', options: BOOKING_STATUSES.map(s=>({id:s,name:s})) },
              ].map(({ label, key, type, options, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  {type === 'select' ? (
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      value={(convertForm as Record<string,string>)[key]}
                      onChange={(e) => setConvertForm({ ...convertForm, [key]: e.target.value })}>
                      <option value="">Pilih...</option>
                      {(options as {id:number|string;name:string}[]).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                  ) : (
                    <input type={type} placeholder={placeholder} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      value={(convertForm as Record<string,string>)[key]}
                      onChange={(e) => setConvertForm({ ...convertForm, [key]: e.target.value })} />
                  )}
                </div>
              ))}
            </div>
            {convertForm.price_per_pax && convertForm.pax && (
              <div className="mt-4 bg-blue-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Total Harga</p>
                <p className="text-xl font-bold text-blue-700">
                  Rp {(Number(convertForm.price_per_pax) * Number(convertForm.pax) * 1_000_000).toLocaleString('id-ID')}
                </p>
              </div>
            )}
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <p className="text-xs text-yellow-700">💡 Lead yang sudah di-convert tetap bisa dilihat di Customer &gt; Riwayat Lead dengan status Converted.</p>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowConvert(null)} className="flex-1 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50">Batal</button>
              <button onClick={handleConvert} className="flex-1 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-semibold">Create Booking</button>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  )
}
