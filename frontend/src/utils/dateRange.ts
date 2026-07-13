export type Period = 'today' | '7d' | '30d' | 'month' | 'custom'

export function fmtISODate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function getDateRange(period: Period, custom?: { date_from: string; date_to: string }) {
  const now = new Date()
  if (period === 'custom') return custom ?? { date_from: fmtISODate(now), date_to: fmtISODate(now) }
  if (period === 'today') return { date_from: fmtISODate(now), date_to: fmtISODate(now) }
  if (period === '7d') {
    const from = new Date(now); from.setDate(now.getDate() - 6)
    return { date_from: fmtISODate(from), date_to: fmtISODate(now) }
  }
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    return { date_from: fmtISODate(from), date_to: fmtISODate(now) }
  }
  const from = new Date(now); from.setDate(now.getDate() - 29)
  return { date_from: fmtISODate(from), date_to: fmtISODate(now) }
}

export const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Hari Ini' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: 'custom', label: 'Custom' },
]
