import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import {
  Plus, Search, Filter, ClipboardList, Play,
  Pencil, Trash2, Copy, RefreshCw, AlertCircle
} from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = {
  LOW:      'bg-gray-100 text-gray-600 border border-gray-200',
  MEDIUM:   'bg-blue-50 text-blue-700 border border-blue-200',
  HIGH:     'bg-orange-50 text-orange-700 border border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:            'bg-gray-100 text-gray-500 border border-gray-200',
  READY_FOR_REVIEW: 'bg-amber-50 text-amber-700 border border-amber-200',
  APPROVED:         'bg-emerald-50 text-emerald-700 border border-emerald-200',
  DEPRECATED:       'bg-orange-50 text-orange-600 border border-orange-200',
  ARCHIVED:         'bg-gray-100 text-gray-400 border border-gray-200',
}

export default function TestCases() {
  const navigate           = useNavigate()
  const [searchParams]     = useSearchParams()
  const projectId          = searchParams.get('projectId')

  const [cases,   setCases]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [filters, setFilters] = useState({ priority: '', status: '', type: '' })
  const [page,    setPage]    = useState(1)
  const [total,   setTotal]   = useState(0)
  const PAGE_SIZE = 20

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = { page, limit: PAGE_SIZE }
      if (projectId)        params.projectId = projectId
      if (search)           params.search    = search
      if (filters.priority) params.priority  = filters.priority
      if (filters.status)   params.status    = filters.status
      if (filters.type)     params.type      = filters.type

      const { data } = await api.get('/test-cases', { params })
      setCases(data.data)
      setTotal(data.pagination.total)
    } catch {
      setError('Failed to load test cases')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, filters, projectId])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    load()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this test case?')) return
    try { await api.delete(`/test-cases/${id}`); load() }
    catch { alert('Failed to delete test case') }
  }

  const handleClone = async (id: number) => {
    try { await api.post(`/test-cases/${id}/clone`); load() }
    catch { alert('Failed to clone test case') }
  }

  const withProject = (path: string) =>
    projectId ? `${path}?projectId=${projectId}` : path

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100">
              <ClipboardList size={22} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Cases</h1>
              <p className="text-sm text-gray-500">
                {total} total
                {projectId && (
                  <span className="ml-2 text-emerald-600 text-xs font-medium">· Project #{projectId}</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(withProject('/test-cases/new'))}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition shadow-sm"
          >
            <Plus size={18} /> New Test Case
          </button>
        </div>

        {/* Search + Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex flex-wrap gap-3 items-center shadow-sm">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-60">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search test cases..."
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition"
              />
            </div>
            <button type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm">
              Search
            </button>
          </form>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={15} className="text-gray-400" />
            {[
              { key: 'priority', opts: ['LOW','MEDIUM','HIGH','CRITICAL'],                                                           label: 'Priority' },
              { key: 'status',   opts: ['DRAFT','READY_FOR_REVIEW','APPROVED','DEPRECATED','ARCHIVED'],                             label: 'Status'   },
              { key: 'type',     opts: ['FUNCTIONAL','REGRESSION','SMOKE','INTEGRATION','UAT','PERFORMANCE','SECURITY','USABILITY'], label: 'Type'     },
            ].map(({ key, opts, label }) => (
              <select key={key} value={(filters as any)[key]}
                onChange={e => { setFilters(f => ({ ...f, [key]: e.target.value })); setPage(1) }}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-emerald-400 shadow-sm"
              >
                <option value="">{label}</option>
                {opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ))}
            <button
              onClick={() => { setFilters({ priority: '', status: '', type: '' }); setSearch(''); setPage(1) }}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-xs text-gray-500 transition font-medium"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-4 text-red-600 text-sm">
            <AlertCircle size={16} /> {error}
            <button onClick={load} className="ml-auto flex items-center gap-1 font-semibold hover:text-red-700">
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw size={28} className="animate-spin text-emerald-500" />
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="inline-flex p-5 bg-white rounded-2xl mb-4 border border-gray-200 shadow-sm">
              <ClipboardList size={40} className="text-gray-300" />
            </div>
            <p className="text-lg text-gray-500">No test cases found</p>
            <button
              onClick={() => navigate(withProject('/test-cases/new'))}
              className="mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm"
            >
              Create your first test case
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="text-left px-6 py-3 font-semibold">Title</th>
                  <th className="text-left px-4 py-3 font-semibold">Project</th>
                  <th className="text-left px-4 py-3 font-semibold">Module</th>
                  <th className="text-left px-4 py-3 font-semibold">Priority</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">Steps</th>
                  <th className="text-left px-4 py-3 font-semibold">Executions</th>
                  <th className="text-right px-6 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map(tc => (
                  <tr key={tc.id} className="hover:bg-gray-50 transition">

                    {/* Title + tags */}
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-800 truncate max-w-xs">{tc.title}</p>
                        {tc.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {tc.tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Project */}
                    <td className="px-4 py-4">
                      <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                        {tc.project?.key ?? '—'}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500">{tc.module}</td>

                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${PRIORITY_COLORS[tc.priority] || ''}`}>
                        {tc.priority}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[tc.status] || ''}`}>
                        {tc.status?.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-sm text-gray-500">{tc.steps?.length ?? 0}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">{tc._count?.executions ?? 0}</td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => navigate(`/execute/${tc.id}`)} title="Execute"
                          className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition">
                          <Play size={15} />
                        </button>
                        <button onClick={() => navigate(withProject(`/test-cases/${tc.id}/edit`))} title="Edit"
                          className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleClone(tc.id)} title="Clone"
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                          <Copy size={15} />
                        </button>
                        <button onClick={() => handleDelete(tc.id)} title="Delete"
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
                <p className="text-sm text-gray-500">
                  Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 rounded-lg text-sm text-gray-600 transition shadow-sm">
                    ← Prev
                  </button>
                  <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-30 rounded-lg text-sm text-gray-600 transition shadow-sm">
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}