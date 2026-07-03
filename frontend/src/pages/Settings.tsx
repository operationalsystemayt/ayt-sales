import { useEffect, useState } from 'react'
import Layout from '../components/Layout/Layout'
import { getSettings, updateSettings } from '../services/api'

export default function Settings() {
  const [dormantHours, setDormantHours] = useState('12')
  const [closeHours, setCloseHours] = useState('72')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSettings().then((res) => {
      setDormantHours(res.data.dormant_hours ?? '12')
      setCloseHours(res.data.close_hours ?? '72')
    })
  }, [])

  const handleSave = async () => {
    setError('')
    try {
      await updateSettings({ dormant_hours: Number(dormantHours), close_hours: Number(closeHours) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Gagal menyimpan')
    }
  }

  return (
    <Layout title="Pengaturan">
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
    </Layout>
  )
}
