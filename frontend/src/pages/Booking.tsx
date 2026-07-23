import { useEffect, useState, useCallback } from 'react'
import {
  Plus, RotateCcw, Eye, ChevronLeft, ChevronRight, BookOpen, Users, DollarSign,
  Clock, Plane, CheckCircle, Wallet, Trash2,
} from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Modal from '../components/ui/Modal'
import Badge from '../components/ui/Badge'
import Avatar from '../components/ui/Avatar'
import EditableCell from '../components/ui/EditableCell'
import HargaCell from '../components/ui/HargaCell'
import CountryMultiSelect from '../components/ui/CountryMultiSelect'
import CountryEditCell from '../components/ui/CountryEditCell'
import PeriodFilter from '../components/ui/PeriodFilter'
import { formatThousands, parseThousands } from '../utils/currency'
import { BOOKING_STATUSES } from '../constants/bookingStatus'
import { getDateRange, fmtISODate, type Period } from '../utils/dateRange'
import { useCanEdit } from '../hooks/useCanEdit'
import { useAuthStore } from '../store/auth'
import {
  getBookings, getBookingSummary, createBooking, updateBooking, updateLead,
  getUsers, getProducts, getCountries, getPayments, addPayment, deletePayment,
} from '../services/api'
import type { Booking, BookingSummary, User, Product, Country, BookingPayment } from '../types'
import { format, differenceInCalendarDays } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

const fmtDate = (d?: string) => d ? format(new Date(d), 'dd MMM yyyy', { locale: idLocale }) : '-'
const fmtRp = (n: number) => n >= 1_000_000 ? `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt` : `Rp ${n.toLocaleString('id-ID')}`

const PAGE_SIZE = 20

const PAYMENT_LABELS = ['DP', 'Payment 1', 'Payment 2', 'Payment 3', 'Custom']

type TripStatus = 'Belum Berangkat' | 'Dalam Perjalanan' | 'Selesai' | '-'

function tripStatus(b: Booking): TripStatus {
  if (!b.departure_date) return '-'
  const start = new Date(b.departure_date)
  const end = new Date(start)
  end.setDate(end.getDate() + Math.max(b.product?.duration_days ?? 1, 1))
  const now = new Date()
  if (now < start) return 'Belum Berangkat'
  if (now <= end) return 'Dalam Perjalanan'
  return 'Selesai'
}

const tripStatusStyle: Record<TripStatus, string> = {
  'Belum Berangkat': 'text-gray-600 bg-gray-100',
  'Dalam Perjalanan': 'text-blue-600 bg-blue-50',
  'Selesai': 'text-green-600 bg-green-50',
  '-': 'text-gray-300 bg-transparent',
}

function isUnpaidSoon(b: Booking): boolean {
  if (b.remaining_payment <= 0 || !b.departure_date) return false
  const daysUntil = differenceInCalendarDays(new Date(b.departure_date), new Date())
  return daysUntil <= 30
}

export default function BookingPage() {
  const canEdit = useCanEdit()
  const { user: currentUser } = useAuthStore()
  const isSales = currentUser?.role === 'sales'
  const [bookings, setBookings] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<BookingSummary | null>(null)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({ sales_id: '', status: '', product_id: '' })
  const [period, setPeriod] = useState<Period>('30d')
  const [customRange, setCustomRange] = useState({ date_from: fmtISODate(new Date()), date_to: fmtISODate(new Date()) })
  const [showAdd, setShowAdd] = useState(false)
  const [showDetail, setShowDetail] = useState<Booking | null>(null)

  const [users, setUsers] = useState<User[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [countries, setCountries] = useState<Country[]>([])

  const [form, setForm] = useState({
    customer_name: '', phone: '', sales_id: '', product_id: '',
    departure_date: '', pax: '1', price_per_pax: '', booking_status: 'Waiting Payment 1', notes: ''
  })
  const [formCountryIds, setFormCountryIds] = useState<number[]>([])

  // Payment modal
  const [showPayments, setShowPayments] = useState<Booking | null>(null)
  const [payments, setPayments] = useState<BookingPayment[]>([])
  const [paymentForm, setPaymentForm] = useState({ amount: '', label: 'DP', customLabel: '' })

  const loadData = useCallback(async () => {
    const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v })
    Object.assign(params, getDateRange(period, customRange))
    const [b, s] = await Promise.all([getBookings(params), getBookingSummary(params)])
    setBookings(b.data.data ?? [])
    setTotal(b.data.total ?? 0)
    setSummary(s.data)
  }, [filters, period, customRange, page])

  useEffect(() => {
    Promise.all([getUsers(), getProducts(), getCountries()]).then(([u, p, c]) => {
      setUsers(u.data); setProducts(p.data); setCountries(c.data)
    })
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleCreate = async () => {
    await createBooking({
      ...form,
      product_id: Number(form.product_id),
      country_ids: formCountryIds,
      pax: Number(form.pax),
      price_per_pax: parseThousands(form.price_per_pax),
    })
    setShowAdd(false)
    setForm({ customer_name:'', phone:'', sales_id:'', product_id:'', departure_date:'', pax:'1', price_per_pax:'', booking_status:'Waiting Payment 1', notes:'' })
    setFormCountryIds([])
    loadData()
  }

  const handleStatusChange = async (id: string, status: string) => {
    await updateBooking(id, { booking_status: status })
    loadData()
  }

  const handleFieldUpdate = async (id: string, field: string, value: string | number | null) => {
    await updateBooking(id, { [field]: value })
    loadData()
  }

  const handleCountriesUpdate = async (id: string, ids: number[]) => {
    await updateBooking(id, { country_ids: ids })
    loadData()
  }

  const handleTotalUpdate = async (b: Booking, newTotal: number) => {
    const pricePerPax = b.pax > 0 ? newTotal / b.pax : newTotal
    await updateBooking(b.id, { price_per_pax: pricePerPax })
    loadData()
  }

  const openPayments = async (booking: Booking) => {
    setShowPayments(booking)
    setPaymentForm({ amount: '', label: 'DP', customLabel: '' })
    const res = await getPayments(booking.id)
    setPayments(res.data)
  }

  const handleAddPayment = async () => {
    if (!showPayments || !paymentForm.amount) return
    const label = paymentForm.label === 'Custom' ? paymentForm.customLabel : paymentForm.label
    if (!label) return
    await addPayment(showPayments.id, { amount: parseThousands(paymentForm.amount), notes: label })
    const res = await getPayments(showPayments.id)
    setPayments(res.data)
    setPaymentForm({ amount: '', label: 'DP', customLabel: '' })
    loadData()
  }

  const handleDeletePayment = async (paymentId: number) => {
    if (!showPayments) return
    await deletePayment(showPayments.id, paymentId)
    const res = await getPayments(showPayments.id)
    setPayments(res.data)
    loadData()
  }

  const paymentsTotalDibayar = payments.reduce((sum, p) => sum + p.amount, 0)
  const paymentsSisaTagihan = (showPayments?.total_price ?? 0) - paymentsTotalDibayar

  const summaryCards = summary ? [
    { label: 'Total Booking', value: summary.total_booking, sub: 'Semua Booking', icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Pax', value: summary.total_pax, sub: 'Orang', icon: Users, color: 'text-green-600 bg-green-50' },
    { label: 'Total Revenue', value: fmtRp(summary.total_revenue), sub: 'Sesuai Filter', icon: DollarSign, color: 'text-purple-600 bg-purple-50' },
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

      {/* Period filter */}
      <div className="mb-4">
        <PeriodFilter period={period} onChange={(p) => { setPeriod(p); setPage(1) }} custom={customRange} onCustomChange={(v) => { setCustomRange(v); setPage(1) }} />
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4 flex flex-wrap gap-2 items-center shadow-sm">
        {!isSales && (
          <select className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400" value={filters.sales_id} onChange={(e) => { setFilters({ ...filters, sales_id: e.target.value }); setPage(1) }}>
            <option value="">Sales: Semua</option>
            {users.filter(u=>u.role==='sales').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
          </select>
        )}
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
        {canEdit && (
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1 bg-blue-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
            <Plus className="w-4 h-4" /> Tambah Booking
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Sales</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. Booking</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Lead Prospect</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tgl Booking</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration to Book</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">No. HP</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Negara</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Keberangkatan</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pax</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Harga</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pembayaran</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Sisa Tagihan</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Catatan</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Aksi</th>
                <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status Keberangkatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bookings.map((b) => {
                const duration = b.lead?.date_received
                  ? differenceInCalendarDays(new Date(b.booking_date), new Date(b.lead.date_received))
                  : null
                const trip = tripStatus(b)
                return (
                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-3 py-3 text-center">
                    <EditableCell
                      value={String(b.sales_id ?? '')}
                      type="select"
                      options={users.filter(u=>u.role==='sales').map((u) => ({ id: u.id, label: u.full_name }))}
                      onSave={(v) => handleFieldUpdate(b.id, 'sales_id', v)}
                      renderValue={() => b.sales ? <Avatar name={b.sales.full_name} src={b.sales.avatar} /> : <span className="text-gray-300">-</span>}
                      disabled={!canEdit || isSales}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-blue-600">{b.booking_no}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    <EditableCell
                      value={b.lead?.date_received ? b.lead.date_received.slice(0, 10) : ''}
                      type="date"
                      onSave={(v) => updateLead(b.lead!.id, { date_received: v || null }).then(loadData)}
                      disabled={!canEdit || !b.lead}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    <EditableCell
                      value={b.booking_date ? b.booking_date.slice(0, 10) : ''}
                      type="date"
                      onSave={(v) => handleFieldUpdate(b.id, 'booking_date', v || null)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{duration !== null ? `${duration} hari` : '-'}</td>
                  <td className="px-3 py-3 font-semibold text-gray-900">
                    <EditableCell
                      value={b.customer?.full_name ?? ''}
                      onSave={(v) => handleFieldUpdate(b.id, 'customer_name', v)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600">
                    <EditableCell
                      value={b.customer?.phone ?? ''}
                      onSave={(v) => handleFieldUpdate(b.id, 'phone', v)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    <EditableCell
                      value={String(b.product_id ?? '')}
                      type="select"
                      options={products.map((p) => ({ id: p.id, label: p.product_name }))}
                      onSave={(v) => handleFieldUpdate(b.id, 'product_id', v ? Number(v) : null)}
                      renderValue={() => b.product?.product_name ?? <span className="text-gray-300">-</span>}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <CountryEditCell
                      countries={countries}
                      selected={b.countries ?? []}
                      onSave={(ids) => handleCountriesUpdate(b.id, ids)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-3 text-gray-600 whitespace-nowrap">
                    <EditableCell
                      value={b.departure_date ? b.departure_date.slice(0, 10) : ''}
                      type="date"
                      onSave={(v) => handleFieldUpdate(b.id, 'departure_date', v || null)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-3 text-right text-gray-700">
                    <EditableCell
                      value={String(b.pax ?? '')}
                      type="number"
                      onSave={(v) => handleFieldUpdate(b.id, 'pax', v ? Number(v) : null)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-3 text-right font-medium text-gray-800">
                    <HargaCell value={b.total_price} onSave={(n) => handleTotalUpdate(b, n)} disabled={!canEdit} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button title="Pembayaran" onClick={() => openPayments(b)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition">
                      <Wallet className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={b.remaining_payment > 0 ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                      {b.remaining_payment > 0 ? fmtRp(b.remaining_payment) : 'Lunas'}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <select
                      value={b.booking_status}
                      onChange={(e) => handleStatusChange(b.id, e.target.value)}
                      disabled={!canEdit}
                      className="text-xs border-0 bg-transparent focus:outline-none cursor-pointer disabled:cursor-default font-medium"
                    >
                      {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-3 max-w-40">
                    <EditableCell value={b.notes ?? ''} onSave={(v) => handleFieldUpdate(b.id, 'notes', v)} disabled={!canEdit} />
                  </td>
                  <td className="px-3 py-3 text-center">
                    <button onClick={() => setShowDetail(b)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${tripStatusStyle[trip]}`}>{trip}</span>
                  </td>
                </tr>
              )})}
              {bookings.length === 0 && (
                <tr><td colSpan={18} className="text-center py-12 text-gray-400">Tidak ada data booking</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-xs text-gray-500">
            Menampilkan {total === 0 ? 0 : (page-1)*PAGE_SIZE+1}–{(page-1)*PAGE_SIZE+bookings.length} dari {total} data
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
            ...(isSales ? [] : [{ label: 'Sales', key: 'sales_id', type: 'select', options: users.filter(u=>u.role==='sales').map(u=>({id:u.id,name:u.full_name})) }]),
            { label: 'Produk *', key: 'product_id', type: 'select', options: products.map(p=>({id:p.id,name:p.product_name})) },
            { label: 'Tanggal Keberangkatan *', key: 'departure_date', type: 'date' },
            { label: 'Jumlah Pax *', key: 'pax', type: 'number', placeholder: '1' },
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Harga per Pax *</label>
            <input placeholder="14.900.000" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              value={form.price_per_pax}
              onChange={(e) => setForm({ ...form, price_per_pax: formatThousands(e.target.value) })} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Negara (opsional, bisa pilih lebih dari satu)</label>
            <CountryMultiSelect countries={countries} selected={formCountryIds} onChange={setFormCountryIds} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
            <textarea className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" rows={2}
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {form.price_per_pax && form.pax && (
            <div className="col-span-2 bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Total Harga</p>
              <p className="text-lg font-bold text-blue-700">
                Rp {(parseThousands(form.price_per_pax) * Number(form.pax)).toLocaleString('id-ID')}
              </p>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
          <button onClick={handleCreate} className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">Simpan Booking</button>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal open={!!showPayments} onClose={() => setShowPayments(null)} title={`Pembayaran - ${showPayments?.booking_no}`} size="md">
        {showPayments && (
          <div className="p-6">
            <div className="space-y-2 max-h-56 overflow-y-auto mb-4">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{p.notes || `Pembayaran ${p.payment_no}`}</p>
                    <p className="text-xs text-gray-400">{fmtDate(p.payment_date) !== '-' ? fmtDate(p.payment_date) : fmtDate(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-800">{fmtRp(p.amount)}</span>
                    {canEdit && (
                      <button onClick={() => handleDeletePayment(p.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {payments.length === 0 && <p className="text-center text-gray-400 text-sm py-6">Belum ada pembayaran</p>}
            </div>

            <div className="grid grid-cols-2 gap-3 bg-blue-50 rounded-xl p-3 mb-4">
              <div>
                <p className="text-xs text-gray-500">Total Dibayar</p>
                <p className="text-sm font-bold text-blue-700">{fmtRp(paymentsTotalDibayar)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Sisa Tagihan</p>
                <p className={`text-sm font-bold ${paymentsSisaTagihan > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {paymentsSisaTagihan > 0 ? fmtRp(paymentsSisaTagihan) : 'Lunas'}
                </p>
              </div>
            </div>

            {canEdit && (
              <>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Tambah Pembayaran</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Harga</label>
                    <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      placeholder="1.000.000"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, amount: formatThousands(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label>
                    <select className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      value={paymentForm.label}
                      onChange={(e) => setPaymentForm({ ...paymentForm, label: e.target.value })}>
                      {PAYMENT_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  {paymentForm.label === 'Custom' && (
                    <div className="col-span-2">
                      <input className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                        placeholder="Catatan custom..."
                        value={paymentForm.customLabel}
                        onChange={(e) => setPaymentForm({ ...paymentForm, customLabel: e.target.value })} />
                    </div>
                  )}
                </div>
                <button onClick={handleAddPayment} className="w-full mt-4 py-2.5 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium">
                  Tambah Pembayaran
                </button>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!showDetail} onClose={() => setShowDetail(null)} title={`Detail Booking - ${showDetail?.booking_no}`} size="md">
        {showDetail && (
          <div className="p-6 space-y-4">
            {isUnpaidSoon(showDetail) && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2">
                ⚠️ Pembayaran belum lunas — keberangkatan kurang dari 1 bulan lagi.
              </div>
            )}
            {tripStatus(showDetail) === 'Dalam Perjalanan' && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-xl px-3 py-2">
                ✈️ Sedang dalam perjalanan.
              </div>
            )}
            {tripStatus(showDetail) === 'Selesai' && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl px-3 py-2">
                ✅ Perjalanan telah selesai.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Customer', showDetail.customer?.full_name ?? '-'],
                ['No. HP', showDetail.customer?.phone ?? '-'],
                ['Produk', showDetail.product?.product_name ?? '-'],
                ['Negara', showDetail.countries?.map(c=>c.name).join(', ') || showDetail.product?.countries?.map(c=>c.name).join(', ') || '-'],
                ['Tgl Lead Prospect', fmtDate(showDetail.lead?.date_received)],
                ['Keberangkatan', fmtDate(showDetail.departure_date)],
                ['Pax', String(showDetail.pax)],
                ['Harga/Pax', fmtRp(showDetail.price_per_pax)],
                ['Total Harga', fmtRp(showDetail.total_price)],
                ['Total Dibayar', fmtRp(showDetail.total_paid)],
                ['Sisa Tagihan', fmtRp(showDetail.remaining_payment)],
                ['Status Keberangkatan', tripStatus(showDetail)],
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
