import { useEffect, useState } from 'react'
import { DollarSign, Users, ShoppingCart, UserCheck, Target, BarChart2, Trophy } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'
import Layout from '../components/Layout/Layout'
import {
  getDashboardSummary, getDashboardLeaderboard, getDashboardTopProducts,
  getDashboardChart, getTopTrips
} from '../services/api'
import type { DashboardSummary, LeaderboardRow, TopProductRow, ChartRow } from '../types'
import Avatar from '../components/ui/Avatar'

const fmt = (n: number) =>
  n >= 1_000_000_000
    ? (n / 1_000_000_000).toFixed(2).replace('.', ',') + ' M'
    : n >= 1_000_000
    ? (n / 1_000_000).toFixed(1) + ' jt'
    : n.toLocaleString('id-ID')

type Period = 'today' | '7d' | '30d' | 'month'

function getDateRange(period: Period) {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  if (period === 'today') return { date_from: fmt(now), date_to: fmt(now) }
  if (period === '7d') {
    const from = new Date(now); from.setDate(now.getDate() - 6)
    return { date_from: fmt(from), date_to: fmt(now) }
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { date_from: fmt(from), date_to: fmt(now) }
  }
  const from = new Date(now); from.setDate(now.getDate() - 29)
  return { date_from: fmt(from), date_to: fmt(now) }
}

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'month', label: 'Bulan Ini' },
]

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('30d')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])
  const [chartData, setChartData] = useState<ChartRow[]>([])
  const [topTrips, setTopTrips] = useState<{ trip_type: string; total_pax: number; revenue: number }[]>([])

  useEffect(() => {
    const params = getDateRange(period)
    getDashboardSummary(params).then((r) => setSummary(r.data)).catch((e) => console.error('[Dashboard] summary:', e))
    getDashboardLeaderboard(params).then((r) => setLeaderboard(r.data ?? [])).catch((e) => console.error('[Dashboard] leaderboard:', e))
    getDashboardTopProducts(params).then((r) => setTopProducts(r.data ?? [])).catch((e) => console.error('[Dashboard] top-products:', e))
    getDashboardChart(params).then((r) => setChartData(r.data ?? [])).catch((e) => console.error('[Dashboard] chart:', e))
    getTopTrips(params).then((r) => setTopTrips(r.data ?? [])).catch((e) => console.error('[Dashboard] top-trips:', e))
  }, [period])

  const kpis = summary
    ? [
        { label: 'Penjualan', value: `Rp ${fmt(summary.penjualan)}`, icon: DollarSign, color: 'text-blue-600 bg-blue-50', trend: null },
        { label: 'Leads', value: fmt(summary.leads), icon: Users, color: 'text-purple-600 bg-purple-50', trend: null },
        { label: 'Pemesan', value: `${fmt(summary.pemesan)} Pax`, icon: ShoppingCart, color: 'text-green-600 bg-green-50', trend: null },
        { label: 'Peserta', value: `${fmt(summary.peserta)} Pax`, icon: UserCheck, color: 'text-yellow-600 bg-yellow-50', trend: null },
        { label: 'CR Pemesan', value: `${summary.cr_pemesan.toFixed(1)}%`, icon: Target, color: 'text-indigo-600 bg-indigo-50', trend: null },
        { label: 'CR Peserta', value: `${summary.cr_peserta.toFixed(1)}%`, icon: BarChart2, color: 'text-teal-600 bg-teal-50', trend: null },
      ]
    : []

  const MEDAL = ['🥇', '🥈', '🥉']

  return (
    <Layout title="Dashboard">
      {/* Period filter */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-gray-500 font-medium">Periode</span>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-all ${
                period === key
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs text-gray-500 font-medium">{label}</span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-lg font-bold text-gray-900 truncate">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts */}
        <div className="lg:col-span-2 space-y-4">
          {/* Revenue chart */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Grafik Penjualan</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => fmt(v)} />
                <Tooltip formatter={(v: number) => [`Rp ${fmt(v)}`, 'Penjualan']} />
                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#colorRev)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Leads vs Closing */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Grafik Leads & Closing</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Leads" />
                <Line type="monotone" dataKey="closing" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Closing" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Deal Maker Ranking */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-semibold text-gray-700">Deal Maker Ranking</h3>
            </div>
            <div className="space-y-3">
              {leaderboard.slice(0, 5).map((row, i) => (
                <div key={row.sales_id} className="flex items-center gap-3">
                  <span className="text-base w-6 flex-shrink-0">{MEDAL[i] ?? `${i + 1}`}</span>
                  <Avatar name={row.full_name} src={row.avatar} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{row.full_name}</p>
                    <p className="text-xs text-gray-400">{row.total_pax} Pax</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                    {fmt(row.revenue)}
                  </span>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Belum ada data</p>
              )}
            </div>
          </div>

          {/* Top Product */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-blue-600 mb-4">Top Product</h3>
            <div className="space-y-2.5">
              {topProducts.map((p) => (
                <div key={p.product_name} className="flex items-center gap-2.5">
                  <span className="text-lg">{p.flag_url}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.product_name}</p>
                    <p className="text-xs text-gray-400">{p.total_pax} Pax</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{fmt(p.revenue)}</span>
                </div>
              ))}
              {topProducts.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Belum ada data</p>
              )}
            </div>
          </div>

          {/* Top Trip */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <h3 className="text-sm font-semibold text-blue-600 mb-4">Top Trip</h3>
            <div className="space-y-2.5">
              {topTrips.map((t) => (
                <div key={t.trip_type} className="flex items-center gap-2.5">
                  <span className="text-lg">{t.trip_type === 'Open Trip' ? '✈️' : '👥'}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{t.trip_type}</p>
                    <p className="text-xs text-gray-400">{t.total_pax} Pax</p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{fmt(t.revenue)}</span>
                </div>
              ))}
              {topTrips.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Belum ada data</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
