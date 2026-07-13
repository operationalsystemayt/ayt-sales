import type { Country } from '../../types'

export default function CountryMultiSelect({
  countries,
  selected,
  onChange,
}: {
  countries: Country[]
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2">
      {countries.map((c) => (
        <label key={c.id} className="flex items-center gap-1.5 text-sm px-2 py-1 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            className="rounded"
            checked={selected.includes(c.id)}
            onChange={() => toggle(c.id)}
          />
          <span>{c.flag_url} {c.name}</span>
        </label>
      ))}
      {countries.length === 0 && <p className="text-xs text-gray-400 col-span-2 text-center py-2">Belum ada negara</p>}
    </div>
  )
}
