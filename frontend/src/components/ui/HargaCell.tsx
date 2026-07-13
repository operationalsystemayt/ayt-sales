import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { formatHarga, formatThousands, parseThousands } from '../../utils/currency'

export default function HargaCell({ value, onSave, disabled = false }: { value?: number | null; onSave: (n: number) => void; disabled?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ? formatThousands(String(value)) : '')

  const commit = () => {
    onSave(parseThousands(draft))
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value ? formatThousands(String(value)) : '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <span
        className={disabled ? '' : 'cursor-pointer hover:text-blue-600 hover:underline underline-offset-2 transition-colors'}
        onClick={() => { if (disabled) return; setDraft(value ? formatThousands(String(value)) : ''); setEditing(true) }}
      >
        {formatHarga(value)}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 justify-end">
      <input
        autoFocus
        className="w-28 border border-blue-400 rounded-lg px-2 py-0.5 text-sm text-right focus:outline-none"
        value={draft}
        onChange={(e) => setDraft(formatThousands(e.target.value))}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
      />
      <button onClick={commit} className="text-green-500 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={cancel} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
    </span>
  )
}
