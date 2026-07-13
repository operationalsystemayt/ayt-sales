import { PERIODS, type Period } from '../../utils/dateRange'

export default function PeriodFilter({
  period,
  onChange,
  custom,
  onCustomChange,
}: {
  period: Period
  onChange: (p: Period) => void
  custom: { date_from: string; date_to: string }
  onCustomChange: (v: { date_from: string; date_to: string }) => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {PERIODS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onChange(key)}
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
      {period === 'custom' && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
            value={custom.date_from}
            onChange={(e) => onCustomChange({ ...custom, date_from: e.target.value })}
          />
          <span className="text-xs text-gray-400">s/d</span>
          <input
            type="date"
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400"
            value={custom.date_to}
            onChange={(e) => onCustomChange({ ...custom, date_to: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
