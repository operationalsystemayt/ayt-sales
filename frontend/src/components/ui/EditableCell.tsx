import { type ReactNode, useState } from 'react'
import { Check, X } from 'lucide-react'

export default function EditableCell({
  value,
  onSave,
  type = 'text',
  options,
  renderValue,
}: {
  value: string
  onSave: (v: string) => void
  type?: 'text' | 'number' | 'select' | 'date'
  options?: { id: number | string; label: string }[]
  renderValue?: (value: string) => ReactNode
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const commit = () => {
    onSave(draft)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        className={`cursor-pointer transition-colors ${renderValue ? '' : 'hover:text-blue-600 hover:underline underline-offset-2'}`}
        onClick={() => { setDraft(value); setEditing(true) }}
      >
        {renderValue ? renderValue(value) : (value || <span className="text-gray-300">—</span>)}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1">
      {type === 'select' && options ? (
        <select
          autoFocus
          className="border border-blue-400 rounded-lg px-2 py-0.5 text-sm focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        >
          <option value="">—</option>
          {options.map((o) => (
            <option key={o.id} value={String(o.id)}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          autoFocus
          type={type}
          className="border border-blue-400 rounded-lg px-2 py-0.5 text-sm w-32 focus:outline-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        />
      )}
      <button onClick={commit} className="text-green-500 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
    </span>
  )
}
