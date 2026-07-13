import { useState } from 'react'
import { Check, X } from 'lucide-react'
import CountryMultiSelect from './CountryMultiSelect'
import type { Country } from '../../types'

export default function CountryEditCell({
  countries,
  selected,
  onSave,
  disabled = false,
}: {
  countries: Country[]
  selected: Country[]
  onSave: (ids: number[]) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number[]>(selected.map((c) => c.id))

  const commit = () => {
    onSave(draft)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(selected.map((c) => c.id))
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        className={disabled ? '' : 'cursor-pointer'}
        onClick={() => { if (disabled) return; setDraft(selected.map((c) => c.id)); setEditing(true) }}
      >
        {selected.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {selected.map((c) => (
              <span key={c.id} className="text-xs bg-gray-100 rounded-full px-2 py-0.5 whitespace-nowrap">{c.flag_url} {c.name}</span>
            ))}
          </span>
        ) : <span className="text-gray-300">-</span>}
      </span>
    )
  }

  return (
    <div className="w-56">
      <CountryMultiSelect countries={countries} selected={draft} onChange={setDraft} />
      <div className="flex justify-end gap-1 mt-1.5">
        <button onClick={commit} className="text-green-500 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  )
}
