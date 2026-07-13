import { useEffect, useState } from 'react'
import { Users, ShoppingCart, DollarSign, Target, Download, FileText, Trophy } from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Avatar from '../components/ui/Avatar'
import PeriodFilter from '../components/ui/PeriodFilter'
import { getReportSales, getDashboardTopProducts } from '../services/api'
import { getDateRange, fmtISODate, type Period } from '../utils/dateRange'
import { exportCSV, exportPDF } from '../utils/export'
import type { ReportSalesRow, TopProductRow } from '../types'

const fmtRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`

export default function Report() {
  const [period, setPeriod] = useState<Period>('30d')
  const [customRange, setCustomRange] = useState({ date_from: fmtISODate(new Date()), date_to: fmtISODate(new Date()) })
  const [rows, setRows] = useState<ReportSalesRow[]>([])
  const [topProducts, setTopProducts] = useState<TopProductRow[]>([])

  useEffect(() => {
    const params = getDateRange(period, customRange)
    getReportSales(params).then((r) => setRows(r.data ?? [])).catch((e) => console.error('[Report] sales:', e))
    getDashboardTopProducts(params).then((r) => setTopProducts(r.data ?? [])).catch((e) => console.error('[Report] top-products:', e))
  }, [period, customRange])

  const totalLeads = rows.reduce((s, r) => s + r.leads_count, 0)
  const totalClosing = rows.reduce((s, r) => s + r.closing_count, 0)
  const totalPax = rows.reduce((s, r) => s + r.total_pax, 0)
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0)

  const kpis = [
    { label: 'Total Leads', value: totalLeads, icon: Users, color: 'text-blue-600 bg-blue-50' },
    { label: 'Total Closing', value: totalClosing, icon: ShoppingCart, color: 'text-green-600 bg-green-50' },
    { label: 'Total Pax', value: totalPax, icon: Target, color: 'text-purple-600 bg-purple-50' },
    { label: 'Total Nilai', value: fmtRp(totalRevenue), icon: DollarSign, color: 'text-orange-600 bg-orange-50' },
  ]

  const csvHeaders = ['Sales', 'Leads', 'Closing', 'Total Pax', 'Nilai (Rp)']
  const csvRows = rows.map((r) => [r.full_name, r.leads_count, r.closing_count, r.total_pax, r.revenue])

  return (
    <Layout title="Report">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <PeriodFilter period={period} onChange={setPeriod} custom={customRange} onCustomChange={setCustomRange} />
        <div className="flex gap-2">
          <button
            onClick={() => exportCSV(`report-sales-${customRange.date_from}_${customRange.date_to}`, csvHeaders, csvRows)}
            className="flex items-center gap-1.5 text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => exportPDF(`report-sales-${customRange.date_from}_${customRange.date_to}`, 'Report Sales', csvHeaders, csvRows)}
            className="flex items-center gap-1.5 text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
          >
            <FileText className="w-3.5 h-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
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
        {/* Per-sales performance table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Performa per Sales</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Leads</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Closing</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pax</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.sales_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={r.full_name} src={r.avatar} />
                      <span className="font-medium text-gray-800">{r.full_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.leads_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.closing_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.total_pax}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmtRp(r.revenue)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Belum ada data</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Top products */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-gray-700">Top Product</h3>
          </div>
          <div className="space-y-2.5">
            {topProducts.map((p) => (
              <div key={p.product_name} className="flex items-center gap-2.5">
                <span className="text-lg">{p.flag_url}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.product_name}</p>
                  <p className="text-xs text-gray-400">{p.total_pax} Pax</p>
                </div>
                <span className="text-sm font-semibold text-gray-700">{fmtRp(p.revenue)}</span>
              </div>
            ))}
            {topProducts.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Belum ada data</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
