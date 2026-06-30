const COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-red-500',
  'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500',
]

function getColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

interface AvatarProps {
  name: string
  src?: string
  size?: 'sm' | 'md'
}

export default function Avatar({ name, src, size = 'sm' }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'

  if (src) {
    return <img src={src} alt={name} className={`${sizeClass} rounded-full object-cover`} />
  }

  return (
    <div
      className={`${sizeClass} rounded-full ${getColor(name)} text-white flex items-center justify-center font-semibold flex-shrink-0`}
      title={name}
    >
      {initials}
    </div>
  )
}
