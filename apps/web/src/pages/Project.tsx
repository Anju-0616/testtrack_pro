import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { FolderKanban, Plus, Users, Bug, ClipboardList, RefreshCw, AlertCircle, X } from 'lucide-react'

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({ name: '', description: '', key: '' })
  const [creating, setCreating] = useState(false)
  const [formErr,  setFormErr]  = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const { data } = await api.get('/projects')
      setProjects(data)
    } catch { setError('Failed to load projects') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    if (!form.name.trim() || !form.key.trim()) { setFormErr('Name and key are required'); return }
    setCreating(true); setFormErr('')
    try {
      const { data } = await api.post('/projects', form)
      setShowForm(false)
      setForm({ name: '', description: '', key: '' })
      navigate(`/projects/${data.id}`)
    } catch (err: any) {
      setFormErr(err?.response?.data?.message || 'Failed to create project')
    } finally { setCreating(false) }
  }

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white rounded-2xl border border-emerald-100 shadow-sm">
            <FolderKanban size={22} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
            <p className="text-sm text-gray-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold rounded-xl transition shadow-sm">
          <Plus size={18} /> New Project
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-24">
          <RefreshCw size={28} className="animate-spin text-emerald-500" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <div className="inline-flex p-5 bg-white rounded-2xl mb-4 border border-gray-100 shadow-sm">
            <FolderKanban size={40} className="text-gray-300" />
          </div>
          <p className="text-lg mb-4 text-gray-500">No projects yet</p>
          <button onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-sm font-medium transition">
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map(p => (
            <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}
              className="bg-white border border-gray-100 hover:border-emerald-200 hover:shadow-md rounded-2xl p-6 cursor-pointer transition shadow-sm group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="text-xs font-mono text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded mb-2 inline-block">
                    {p.key}
                  </span>
                  <h2 className="text-lg font-bold text-gray-800 group-hover:text-emerald-600 transition">{p.name}</h2>
                </div>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">{p.myRole}</span>
              </div>
              {p.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{p.description}</p>}
              <div className="flex items-center gap-4 text-xs text-gray-400 pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1"><ClipboardList size={12} /> {p._count?.testCases ?? 0} cases</span>
                <span className="flex items-center gap-1"><Bug size={12} /> {p._count?.bugs ?? 0} bugs</span>
                <span className="flex items-center gap-1"><Users size={12} /> {p.members?.length ?? 0} members</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-100 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">New Project</h2>
              <button onClick={() => { setShowForm(false); setFormErr('') }}
                className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Project Name <span className="text-red-400">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. TestTrack Web App"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-emerald-400 transition" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Project Key <span className="text-red-400">*</span></label>
                <input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                  placeholder="e.g. TT" maxLength={6}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 font-mono focus:outline-none focus:border-emerald-400 transition" />
                <p className="text-xs text-gray-400 mt-1">Short uppercase code, max 6 chars</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="What is this project about?"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-emerald-400 transition resize-none" />
              </div>
              {formErr && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {formErr}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => { setShowForm(false); setFormErr('') }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition">
                {creating ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}