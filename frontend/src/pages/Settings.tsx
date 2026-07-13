import { useEffect, useState, useCallback } from 'react'
import { UserPlus } from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Avatar from '../components/ui/Avatar'
import { useAuthStore } from '../store/auth'
import { getSettings, updateSettings, getUsers, createUser } from '../services/api'
import type { User } from '../types'

const ROLE_LABELS: Record<string, string> = { admin: 'Admin', sales: 'Sales', viewer: 'Viewer' }

export default function Settings() {
  const { user: currentUser } = useAuthStore()
  const isAdmin = currentUser?.role === 'admin'

  const [dormantHours, setDormantHours] = useState('12')
  const [closeHours, setCloseHours] = useState('72')
  const [provider, setProvider] = useState('waba')
  const [contactDormantDays, setContactDormantDays] = useState('365')
  const [contactActiveDays, setContactActiveDays] = useState('60')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const [users, setUsers] = useState<User[]>([])
  const [showAddUser, setShowAddUser] = useState(false)
  const [userForm, setUserForm] = useState({ full_name: '', email: '', password: '', role: 'sales' })
  const [userError, setUserError] = useState('')

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return
    const res = await getUsers()
    setUsers(res.data ?? [])
  }, [isAdmin])

  useEffect(() => {
    getSettings().then((res) => {
      setDormantHours(res.data.dormant_hours ?? '12')
      setCloseHours(res.data.close_hours ?? '72')
      setProvider(res.data.whatsapp_provider ?? 'waba')
      setContactDormantDays(res.data.contact_dormant_days ?? '365')
      setContactActiveDays(res.data.contact_active_days ?? '60')
    })
    loadUsers()
  }, [loadUsers])

  const handleSave = async () => {
    setError('')
    try {
      await updateSettings({
        dormant_hours: Number(dormantHours),
        close_hours: Number(closeHours),
        whatsapp_provider: provider,
        contact_dormant_days: Number(contactDormantDays),
        contact_active_days: Number(contactActiveDays),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Gagal menyimpan')
    }
  }

  const handleAddUser = async () => {
    setUserError('')
    if (!userForm.full_name || !userForm.email || !userForm.password) {
      setUserError('Nama, email, dan password wajib diisi')
      return
    }
    try {
      await createUser(userForm)
      setShowAddUser(false)
      setUserForm({ full_name: '', email: '', password: '', role: 'sales' })
      loadUsers()
    } catch (err: any) {
      setUserError(err.response?.data?.error ?? 'Gagal menambahkan user')
    }
  }

  return (
    <Layout title="Pengaturan">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-md mb-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Provider WhatsApp</h3>
        <p className="text-xs text-gray-500 mb-4">
          Pilih integrasi mana yang dipakai untuk menerima dan mengirim pesan WhatsApp.
        </p>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:border-blue-400"
        >
          <option value="waba">WABA (Meta Cloud API)</option>
          <option value="waha">WAHA (self-hosted)</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-md">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Auto Status Lead</h3>
        <p className="text-xs text-gray-500 mb-4">
          Saat sales membalas chat, status lead langsung menjadi "Waiting Customer". Jika customer tidak membalas lagi,
          status akan meluruh secara otomatis mengikuti jam di bawah ini.
        </p>

        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jadi Dormant setelah (jam)</label>
            <input
              type="number"
              min={1}
              value={dormantHours}
              onChange={(e) => setDormantHours(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 w-32 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jadi Close setelah (jam)</label>
            <input
              type="number"
              min={1}
              value={closeHours}
              onChange={(e) => setCloseHours(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 w-32 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <button onClick={handleSave} className="mt-5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Simpan
        </button>
        {saved && <span className="ml-3 text-xs text-green-600">Tersimpan</span>}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-md mt-4">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Ambang Batas Contact</h3>
        <p className="text-xs text-gray-500 mb-4">
          Menentukan kapan sebuah contact dianggap Active atau Dormant di halaman Contact.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Active jika ada order dalam (hari)</label>
            <input
              type="number"
              min={1}
              value={contactActiveDays}
              onChange={(e) => setContactActiveDays(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 w-32 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Dormant jika tidak ada order dalam (hari)</label>
            <input
              type="number"
              min={1}
              value={contactDormantDays}
              onChange={(e) => setContactDormantDays(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 w-32 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <button onClick={handleSave} className="mt-5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          Simpan
        </button>
      </div>

      {isAdmin && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-md mt-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-800">Kelola User</h3>
            <button
              onClick={() => setShowAddUser((v) => !v)}
              className="flex items-center gap-1 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium"
            >
              <UserPlus className="w-3.5 h-3.5" /> Tambah User
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Admin bisa mengubah semua data, Sales bisa mengubah data miliknya, Viewer hanya bisa melihat data.
          </p>

          {showAddUser && (
            <div className="border border-gray-200 rounded-xl p-4 mb-4 space-y-3">
              {userError && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{userError}</div>}
              <input placeholder="Nama lengkap" value={userForm.full_name}
                onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:border-blue-400" />
              <input placeholder="Email" type="email" value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:border-blue-400" />
              <input placeholder="Password" type="password" value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:border-blue-400" />
              <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:border-blue-400">
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="viewer">Viewer</option>
              </select>
              <button onClick={handleAddUser} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
                Simpan User
              </button>
            </div>
          )}

          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <Avatar name={u.full_name} src={u.avatar} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{ROLE_LABELS[u.role] ?? u.role}</span>
              </div>
            ))}
            {users.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Belum ada user</p>}
          </div>
        </div>
      )}
    </Layout>
  )
}
