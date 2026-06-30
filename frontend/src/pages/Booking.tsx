import { useEffect, useState, useCallback } from 'react'
import { Plus, RotateCcw, Eye, ChevronLeft, ChevronRight, BookOpen, Users, DollarSign, Clock, Plane, CheckCircle } from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import {
  getBookings, getBookingSummary, createBooking, updateBooking,
  getUsers, getProducts
} from '../services/api'
import type { Booking, BookingSummary, User, Product } from '../types'
import { format } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const fmtDate = (d?: string) => d ? format(new Date(d), 'dd MMM yyyy', { locale: idLocale }) : '-'
const fmtRp = (n: number) => n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt` : `Rp ${n.toLocaleString('id-ID')}`

const PAGE_SIZE = 20

const BOOKING_STATUSES = [
  'Waiting Payment 1','Waiting Payment 2','Waiting Payment 3',
  'Waiting Passport','Waiting Visa','Ticketing','Ready to Depart','Completed','Cancelled'
]

export default function BookingPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [summary, setSummary] = useState<BookingSummary | null>(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ sales_id: '', status: '', product_id: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [showDetail, setShowDetail] = useState<Booking | null>(null)

  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])

  const [form, setForm] = useState({
    customer_name: '', phone: '', sales_id: '', product_id: '',
    departure_date: '', pax: '1', price_per_pax: '', booking_status: 'Waiting Payment 1', notes: ''
  })

  const loadData = useCallback(async () => {
    const params: Record<string, string> = {}
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    const [b, s] = await Promise.all([getBookings(params), getBookingSummary(params)])
    setBookings(b.data)
    setSummary(s.data)
  }, [filters])

  useEffect(() => {
    Promise.all([getUsers(), getProducts()]).then(([u, p]) => {
      setUsers(u.data); setProducts(p.data)
    })
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const pagedBookings = bookings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(bookings.length / PAGE_SIZE)

  const handleCreate = async () => {
    await createBooking({
      ...form,
      product_id: Number(form.product_id),
      pax: Number(form.pax),
      price_per_pax: Number(form.price_per_pax) * 1_000_000,
    })
    setShowAdd(false)
    setForm({ customer_name:'', phone:'', sales_id:'', product_id:'', departure_date:'', pax:'1', price_per_pax:'', booking_status:'Waiting Payment 1', notes:'' })
    loadData()
  }

  const handleStatusChange = async (id: string, status: string) => {
    await updateBooking(id, { booking_status: status })
    loadData()
  }

  const summaryCards = summary ? [
    { label: 'Total Booking', value: summary.total_booking, sub: 'Semua Booking', icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Pax', value: summary.total_pax, sub: 'Orang', icon: Users, color: 'text-green-600 bg-green-50' },
    { label: 'Total Revenue', value: fmtRp(summary.total_revenue), sub: 'Semua Booking', icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
    { label: 'Menunggu Pembayaran', value: fmtRp(summary.pending_payment), sub: `${bookings.filter(b=>b.remaining_payment>0).length} Booking`, icon: Clock, color: 'text-orange-600 bg-orange-50' },
    { label: 'Akan Berangkat', value: summary.upcoming_30_days, sub: 'Dalam 30 Hari', icon: Plane, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'Selesai', value: summary.completed, sub: 'Booking', icon: CheckCircle, color: 'text-teal-600 bg-teal-50' },
  ] : []

  return (
    <Layout title="Booking">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        {summaryCards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-lg font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center shadow-sm">
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.sales_id} onChange={(e) => { setFilters({ ...filters, sales_id: e.target.value }); setPage(1) }}>
          <option value="">Sales: Semua</option>
          {users.filter(u=>u.role==='sales').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}>
          <option value="">Status: Semua</option>
          {BOOKING_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.product_id} onChange={(e) => { setFilters({ ...filters, product_id: e.target.value }); setPage(1) }}>
          <option value="">Produk: Semua</option>
          {products.map(p=><option key={p.id} value={p.id}>{p.product_name}</option>)}
        </select>
        <button onClick={() => { setFilters({ sales_id:'', status:'', product_id:'' }); setPage(1) }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Tambah Booking
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8">Aksi</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Booking</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Booking</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. HP</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Negara</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keberangkatan</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pax</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Harga</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sisa Tagihan</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagedBookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-3">
                    <button onClick={() => setShowDetail(b)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-blue-600">{b.booking_no}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{fmtDate(b.booking_date)}</td>
                  <td className="px-3 py-3 font-semibold text-gray-900">{b.customer?.full_name ?? '-'}</td>
                  <td className="px-3 py-3 text-gray-600">{b.customer?.phone ?? '-'}</td>
                  <td className="px-3 py-3 text-gray-700">{b.product?.product_name ?? '-'}</td>
                  <td className="px-3 py-3">
                    {b.product?.country ? (
                      <span className="flex items-center gap-1">
                        <span>{b.product.country.flag_url}</span>
                        <span className="text-gray-600">{b.product.country.name}</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{fmtDate(b.departure_date)}</td>
                  <td className="px-3 py-3 text-right text-gray-700">{b.pax}</td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">{fmtRp(b.total_price)}</td>
                  <td className="px-3 py-3 text-right">
                    <span className={b.remaining_payment > 0 ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                      {b.remaining_payment > 0 ? fmtRp(b.remaining_payment) : 'Lunas'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <select
                      value={b.booking_status}
                      onChange={(e) => handleStatusChange(b.id, e.target.value)}
                      className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer font-medium"
                    >
                      {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {b.sales ? <Avatar name={b.sales.full_name} src={b.sales.avatar} /> : '-'}
                  </td>
                </tr>
              ))}
              {pagedBookings.length === 0 && (
                <tr><td colSpan={13} className="text-center py-12 text-gray-400">Tidak ada data booking</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Menampilkan {Math.min((page-1)*PAGE_SIZE+1, bookings.length)}–{Math.min(page*PAGE_SIZE, bookings.length)} dari {bookings.length} data
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(Math.max(1, page-1))} disabled={page===1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i+1).map((p) => (
              <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-medium ${p===page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>{p}</button>
            ))}
            <button onClick={() => setPage(Math.min(totalPages, page+1))} disabled={page===totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Booking Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Booking" size="md">
        <div className="p-6 grid grid-cols-2 gap-4">
          {[
            { label: 'Nama Customer *', key: 'customer_name', type: 'text', placeholder: 'Nama lengkap' },
            { label: 'No. HP *', key: 'phone', type: 'text', placeholder: '0812-3456-7890' },
            { label: 'Sales', key: 'sales_id', type: 'select', options: users.filter(u=>u.role==='sales').map(u=>({id:u.id,name:u.full_name})) },
            { label: 'Produk *', key: 'product_id', type: 'select', options: products.map(p=>({id:p.id,name:p.product_name})) },
            { label: 'Tanggal Keberangkatan *', key: 'departure_date', type: 'date' },
            { label: 'Jumlah Pax *', key: 'pax', type: 'number', placeholder: '1' },
            { label: 'Harga per Pax (jt) *', key: 'price_per_pax', type: 'number', placeholder: '14.9' },
            { label: 'Status Awal', key: 'booking_status', type: 'select', options: BOOKING_STATUSES.map(s=>({id:s,name:s})) },
          ].map(({ label, key, type, options, placeholder }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              {type === 'select' ? (
                <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={(form as Record<string,string>)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                  <option value="">Pilih...</option>
                  {(options as {id:number|string;name:string}[]).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <input type={type} placeholder={placeholder} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  value={(form as Record<string,string>)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              )}
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" rows={2}
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {form.price_per_pax && form.pax && (
            <div className="col-span-2 bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Harga</p>
              <p className="text-lg font-bold text-blue-700">
                Rp {(Number(form.price_per_pax) * Number(form.pax) * 1_000_000).toLocaleString('id-ID')}
              </p>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
          <button onClick={handleCreate} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">Simpan Booking</button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Detail Booking - ${showDetail?.booking_no}`} size="md">
        {showDetail && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Customer', showDetail.customer?.full_name ?? '-'],
                ['No. HP', showDetail.customer?.phone ?? '-'],
                ['Produk', showDetail.product?.product_name ?? '-'],
                ['Negara', showDetail.product?.country?.name ?? '-'],
                ['Keberangkatan', fmtDate(showDetail.departure_date)],
                ['Pax', String(showDetail.pax)],
                ['Harga/Pax', fmtRp(showDetail.price_per_pax)],
                ['Total Harga', fmtRp(showDetail.total_price)],
                ['Total Dibayar', fmtRp(showDetail.total_paid)],
                ['Sisa Tagihan', fmtRp(showDetail.remaining_payment)],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{val}</p>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              <Badge label={showDetail.booking_status} type="booking-status" />
            </div>
            {showDetail.notes && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Catatan</p>
                <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{showDetail.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  )
}
