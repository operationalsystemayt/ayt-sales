import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, BookOpen, Package, TrendingUp, LogOut, Plane, SlidersHorizontal, MessageCircle, Contact } from 'lucide-react'
import { useAuthStore } from '../../store/auth'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/leads', icon: Users, label: 'Leads & Prospects' },
  { to: '/booking', icon: BookOpen, label: 'Booking' },
  { to: '/report', icon: TrendingUp, label: 'Report' },
  { to: '/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/contact', icon: Contact, label: 'Contact' },
  { to: '/setup', icon: Package, label: 'Setup' },
  { to: '/settings', icon: SlidersHorizontal, label: 'Pengaturan' },
]

export default function Sidebar() {
  const { logout } = useAuthStore()

  return (
    <aside className="fixed left-0 top-0 h-screen w-16 bg-white border-r border-gray-100 flex flex-col items-center py-4 z-30 shadow-sm">
      <div className="mb-6">
        <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
          <Plane className="w-5 h-5 text-white" />
        </div>
      </div>

      <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            title={label}
            className={({ isActive }) =>
              `w-full flex items-center justify-center h-10 rounded-xl transition-all group relative ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-600 rounded-r-full" />
                )}
                <Icon className="w-5 h-5" />
                <span className="absolute left-full ml-2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={logout}
        title="Logout"
        className="w-full flex items-center justify-center h-10 rounded-xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all px-2 group relative"
      >
        <LogOut className="w-5 h-5" />
        <span className="absolute left-full ml-2 bg-gray-900 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
          Logout
        </span>
      </button>
    </aside>
  )
}
