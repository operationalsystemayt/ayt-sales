interface BadgeProps {
  label: string
  type: 'quality' | 'status' | 'group' | 'booking-status'
}

const qualityMap: Record<string, { icon: string; className: string }> = {
  Cold: { icon: '❄️', className: 'text-blue-600 bg-blue-50' },
  Warm: { icon: '☀️', className: 'text-orange-500 bg-orange-50' },
  Hot:  { icon: '🔥', className: 'text-red-500 bg-red-50' },
}

const statusMap: Record<string, { className: string }> = {
  'Need Response':    { className: 'text-red-600 bg-red-50 border border-red-200' },
  'Waiting Customer': { className: 'text-yellow-600 bg-yellow-50 border border-yellow-200' },
  Dormant:            { className: 'text-gray-500 bg-gray-100 border border-gray-200' },
}

const groupMap: Record<string, string> = {
  'Open Trip':    'text-blue-600 bg-blue-50',
  'Private Trip': 'text-purple-600 bg-purple-50',
}

const bookingStatusMap: Record<string, string> = {
  'Waiting Payment 1': 'bg-yellow-100 text-yellow-700',
  'Waiting Payment 2': 'bg-orange-100 text-orange-700',
  'Waiting Payment 3': 'bg-red-100 text-red-700',
  'Waiting DP':        'bg-yellow-100 text-yellow-700',
  'Lunas':             'bg-green-100 text-green-700',
  'Waiting Passport':  'bg-blue-100 text-blue-700',
  'Waiting Visa':      'bg-purple-100 text-purple-700',
  'Ticketing':         'bg-indigo-100 text-indigo-700',
  'Ready to Depart':   'bg-cyan-100 text-cyan-700',
  'Completed':         'bg-green-100 text-green-700',
  'Cancelled':         'bg-gray-100 text-gray-600',
}

export default function Badge({ label, type }: BadgeProps) {
  if (type === 'quality') {
    const q = qualityMap[label] ?? { icon: '', className: 'text-gray-600 bg-gray-100' }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${q.className}`}>
        <span>{q.icon}</span> {label}
      </span>
    )
  }

  if (type === 'status') {
    const s = statusMap[label] ?? { className: 'text-gray-500 bg-gray-100 border border-gray-200' }
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
        {label}
      </span>
    )
  }

  if (type === 'group') {
    const cls = groupMap[label] ?? 'text-gray-600 bg-gray-100'
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
        {label}
      </span>
    )
  }

  if (type === 'booking-status') {
    const cls = bookingStatusMap[label] ?? 'bg-gray-100 text-gray-600'
    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
        {label}
      </span>
    )
  }

  return <span className="text-xs text-gray-500">{label}</span>
}
