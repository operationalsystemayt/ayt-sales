// Exact multiples of 1,000,000 -> "Njt"; otherwise TRUNCATE (not round) to 2 decimals.
export function formatHarga(n?: number | null): string {
  if (n === undefined || n === null) return '-'
  if (n % 1_000_000 === 0) return `${n / 1_000_000}jt`
  const truncated = Math.trunc((n / 1_000_000) * 100) / 100
  return `${truncated}jt`
}

// Live thousands-separator (Indonesian dot convention) while typing.
export function formatThousands(raw: string): string {
  const clean = raw.replace(/\D/g, '')
  return clean ? clean.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ''
}

export function parseThousands(formatted: string): number {
  const clean = formatted.replace(/\D/g, '')
  return clean ? parseInt(clean, 10) : 0
}
