import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Package, Layers, Check, X } from 'lucide-react'
import Layout from '../components/Layout/Layout'
import Modal from '../components/ui/Modal'
import EditableCell from '../components/ui/EditableCell'
import {
  getProducts, createProduct, updateProduct, deleteProduct,
  getProductGroups, createProductGroup, updateProductGroup, deleteProductGroup,
  getCountries,
} from '../services/api'
import type { Product, ProductGroup, Country } from '../types'

type Tab = 'products' | 'groups'

// ── Products Tab ──────────────────────────────────────────────────────────────
function ProductsTab() {
  const [products, setProducts] = useState<Product[]>([])
  const [countries, setCountries] = useState<Country[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    product_name: '', country_id: '', trip_type: 'Open Trip',
    duration_days: '', price_per_pax: '', description: '',
  })

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([getProducts(true), getCountries()])
    setProducts(p.data ?? [])
    setCountries(c.data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const countryOptions = countries.map((c) => ({ id: c.id, label: `${c.flag_url} ${c.name}` }))

  const handleAdd = async () => {
    await createProduct({
      ...form,
      country_id: form.country_id ? Number(form.country_id) : null,
      duration_days: Number(form.duration_days),
      price_per_pax: Number(form.price_per_pax) * 1_000_000,
    })
    setShowAdd(false)
    setForm({ product_name: '', country_id: '', trip_type: 'Open Trip', duration_days: '', price_per_pax: '', description: '' })
    load()
  }

  const handleUpdate = async (id: number, field: string, raw: string) => {
    const val =
      field === 'country_id' ? (raw ? Number(raw) : null) :
      field === 'duration_days' ? Number(raw) :
      field === 'price_per_pax' ? Number(raw) * 1_000_000 :
      raw
    await updateProduct(id, { [field]: val })
    load()
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Nonaktifkan produk "${name}"?`)) return
    await deleteProduct(id)
    load()
  }

  const fmtPrice = (n: number) => n ? `${(n / 1_000_000).toFixed(1)} jt` : '—'

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Produk Trip</h2>
          <p className="text-xs text-gray-400 mt-0.5">Klik nilai untuk edit langsung. Hapus akan menonaktifkan produk.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Tambah Produk
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['No.', 'Nama Produk', 'Negara', 'Tipe Trip', 'Durasi', 'Harga/Pax', 'Status', 'Aksi'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((p, i) => (
              <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <EditableCell
                    value={p.product_name}
                    onSave={(v) => handleUpdate(p.id, 'product_name', v)}
                  />
                </td>
                <td className="px-4 py-3">
                  <EditableCell
                    value={String(p.country_id ?? '')}
                    type="select"
                    options={countryOptions}
                    onSave={(v) => handleUpdate(p.id, 'country_id', v)}
                  />
                  {p.country && (
                    <span className="block text-xs text-gray-400 mt-0.5">{p.country.flag_url} {p.country.name}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <EditableCell
                    value={p.trip_type}
                    type="select"
                    options={[{ id: 'Open Trip', label: 'Open Trip' }, { id: 'Private Trip', label: 'Private Trip' }]}
                    onSave={(v) => handleUpdate(p.id, 'trip_type', v)}
                  />
                </td>
                <td className="px-4 py-3">
                  <EditableCell
                    value={String(p.duration_days ?? '')}
                    type="number"
                    onSave={(v) => handleUpdate(p.id, 'duration_days', v)}
                  />
                  {p.duration_days ? <span className="text-gray-400 text-xs"> hari</span> : null}
                </td>
                <td className="px-4 py-3">
                  <EditableCell
                    value={String(p.price_per_pax ? p.price_per_pax / 1_000_000 : '')}
                    type="number"
                    onSave={(v) => handleUpdate(p.id, 'price_per_pax', v)}
                  />
                  {p.price_per_pax ? <span className="text-gray-400 text-xs"> = {fmtPrice(p.price_per_pax)}</span> : null}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(p.id, p.product_name)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Nonaktifkan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={8} className="text-center py-12 text-gray-400">Belum ada produk</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Product Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Produk" size="md">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nama Produk *</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Contoh: Japan Sakura 5D"
                value={form.product_name}
                onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Negara</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                value={form.country_id}
                onChange={(e) => setForm({ ...form, country_id: e.target.value })}
              >
                <option value="">Pilih negara</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.flag_url} {c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipe Trip</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                value={form.trip_type}
                onChange={(e) => setForm({ ...form, trip_type: e.target.value })}
              >
                <option>Open Trip</option>
                <option>Private Trip</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Durasi (hari)</label>
              <input
                type="number" min="1"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="5"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Harga per Pax (juta)</label>
              <div className="relative">
                <input
                  type="number" min="0" step="0.1"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 pr-7 text-sm focus:outline-none focus:border-blue-400"
                  placeholder="14.9"
                  value={form.price_per_pax}
                  onChange={(e) => setForm({ ...form, price_per_pax: e.target.value })}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">jt</span>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Deskripsi</label>
              <textarea
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Deskripsi singkat produk..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
          <button
            onClick={handleAdd}
            disabled={!form.product_name}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      </Modal>
    </>
  )
}

// ── Product Groups Tab ────────────────────────────────────────────────────────
function GroupsTab() {
  const [groups, setGroups] = useState<ProductGroup[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const load = useCallback(async () => {
    const res = await getProductGroups()
    setGroups(res.data ?? [])
  }, [])

  useEffect(() => { load() }, [load])

  const handleAdd = async () => {
    if (!newName.trim()) return
    await createProductGroup({ name: newName.trim() })
    setNewName('')
    setShowAdd(false)
    load()
  }

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return
    await updateProductGroup(id, { name: editName.trim() })
    setEditingId(null)
    load()
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus grup "${name}"?`)) return
    await deleteProductGroup(id)
    load()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Grup Produk</h2>
          <p className="text-xs text-gray-400 mt-0.5">Contoh: Open Trip, Private Trip</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 font-medium"
        >
          <Plus className="w-4 h-4" /> Tambah Grup
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              {['No.', 'Nama Grup', 'Aksi'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {groups.map((g, i) => (
              <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs w-16">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-800">
                  {editingId === g.id ? (
                    <span className="flex items-center gap-2">
                      <input
                        autoFocus
                        className="border border-blue-400 rounded-lg px-2 py-1 text-sm focus:outline-none w-48"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleUpdate(g.id); if (e.key === 'Escape') setEditingId(null) }}
                      />
                      <button onClick={() => handleUpdate(g.id)} className="text-green-500 hover:text-green-700"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{g.name}</span>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditingId(g.id); setEditName(g.name) }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(g.id, g.name)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr><td colSpan={3} className="text-center py-12 text-gray-400">Belum ada grup produk</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Tambah Grup Produk" size="sm">
        <div className="p-6">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Nama Grup *</label>
          <input
            autoFocus
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            placeholder="Contoh: Open Trip"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
          />
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Batal</button>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="px-6 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
      </Modal>
    </>
  )
}

// ── Main Setup Page ───────────────────────────────────────────────────────────
const TABS: { key: Tab; label: string; icon: typeof Package }[] = [
  { key: 'products', label: 'Produk', icon: Package },
  { key: 'groups',   label: 'Grup Produk', icon: Layers },
]

export default function Setup() {
  const [tab, setTab] = useState<Tab>('products')

  return (
    <Layout title="Setup">
      <div className="flex gap-6">
        {/* Left tab nav */}
        <aside className="w-52 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2 sticky top-20">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 px-3 py-2">
              Master Data
            </p>
            <nav className="flex flex-col gap-0.5">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                    tab === key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {tab === 'products' && <ProductsTab />}
          {tab === 'groups'   && <GroupsTab />}
        </div>
      </div>
    </Layout>
  )
}
