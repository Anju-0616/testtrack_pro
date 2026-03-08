import { useEffect, useState } from 'react'
import api from '../lib/api'
import {
  Plus, Layers, ChevronRight, ChevronDown, Pencil, Trash2,
  RefreshCw, AlertCircle, X, FolderOpen, ClipboardList,
  Archive, ArchiveRestore, Search, ListFilter, CheckSquare, Square,
  PackagePlus
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: number
  title: string
  status: string
  priority: string
}

interface SuiteItem {
  testCaseId: number
  order: number
  testCase: TestCase
}

interface Suite {
  id: number
  name: string
  description?: string
  module?: string
  isArchived: boolean
  parentId?: number | null
  creator: { id: number; name: string }
  children: Suite[]
  testCases: SuiteItem[]
  _count: { testCases: number }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  LOW:      'bg-gray-700 text-gray-300',
  MEDIUM:   'bg-blue-900/50 text-blue-300',
  HIGH:     'bg-orange-900/50 text-orange-300',
  CRITICAL: 'bg-red-900/50 text-red-300',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:            'bg-gray-700 text-gray-400',
  READY_FOR_REVIEW: 'bg-yellow-900/50 text-yellow-300',
  APPROVED:         'bg-emerald-900/50 text-emerald-300',
  DEPRECATED:       'bg-orange-900/50 text-orange-400',
  ARCHIVED:         'bg-gray-800 text-gray-500',
}

// ─── Suite Form Modal ─────────────────────────────────────────────────────────

interface SuiteFormProps {
  initial?: Partial<Suite>
  parentId?: number | null
  onClose: () => void
  onSaved: () => void
}

function SuiteFormModal({ initial, parentId, onClose, onSaved }: SuiteFormProps) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    name:        initial?.name        || '',
    description: initial?.description || '',
    module:      initial?.module      || '',
    parentId:    parentId ?? initial?.parentId ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Suite name is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        module:      form.module.trim()      || undefined,
        parentId:    form.parentId           || undefined,
      }
      if (isEdit) {
        await api.put(`/test-suites/${initial!.id}`, payload)
      } else {
        await api.post('/test-suites', payload)
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save suite')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Layers size={20} className="text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">
              {isEdit ? 'Edit Suite' : parentId ? 'Add Child Suite' : 'New Test Suite'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Suite Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. User Authentication Suite"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Module / Feature</label>
            <input
              value={form.module}
              onChange={e => set('module', e.target.value)}
              placeholder="e.g. Authentication"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What does this suite cover?"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Create Suite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Test Case Picker Modal ───────────────────────────────────────────────────

interface PickerProps {
  suiteId: number
  suiteName: string
  alreadyAdded: number[]
  onClose: () => void
  onSaved: () => void
}

function TestCasePickerModal({ suiteId, suiteName, alreadyAdded, onClose, onSaved }: PickerProps) {
  const [allCases, setAllCases] = useState<TestCase[]>([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [search,   setSearch]   = useState('')
  const [priority, setPriority] = useState('')
  const [status,   setStatus]   = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      setError('')
      try {
        const { data } = await api.get('/test-cases', { params: { limit: 200 } })
        const available = (data.data as TestCase[]).filter(tc => !alreadyAdded.includes(tc.id))
        setAllCases(available)
      } catch {
        setError('Failed to load test cases')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const filtered = allCases.filter(tc => {
    const matchSearch   = !search   || tc.title.toLowerCase().includes(search.toLowerCase())
    const matchPriority = !priority || tc.priority === priority
    const matchStatus   = !status   || tc.status   === status
    return matchSearch && matchPriority && matchStatus
  })

  const toggleOne = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const toggleAll = () =>
    setSelected(
      selected.size === filtered.length ? new Set() : new Set(filtered.map(tc => tc.id))
    )

  const handleAdd = async () => {
    if (selected.size === 0) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/test-suites/${suiteId}/test-cases`, { testCaseIds: Array.from(selected) })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add test cases')
    } finally {
      setSaving(false)
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(tc => selected.has(tc.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-900/30 rounded-lg">
              <PackagePlus size={18} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Add Test Cases</h2>
              <p className="text-xs text-gray-500 truncate max-w-xs">to "{suiteName}"</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition p-1">
            <X size={20} />
          </button>
        </div>

        {/* Search + Filters */}
        <div className="px-6 py-3 border-b border-gray-800 shrink-0 space-y-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title..."
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>
          <div className="flex items-center gap-2">
            <ListFilter size={13} className="text-gray-500 shrink-0" />
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Priorities</option>
              {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Statuses</option>
              {['DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'DEPRECATED'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            {(search || priority || status) && (
              <button
                onClick={() => { setSearch(''); setPriority(''); setStatus('') }}
                className="text-xs text-gray-500 hover:text-white px-2 py-1.5 rounded-lg hover:bg-gray-800 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Select-all bar */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-6 py-2 bg-gray-950/50 border-b border-gray-800 shrink-0">
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition"
            >
              {allFilteredSelected
                ? <CheckSquare size={14} className="text-emerald-400" />
                : <Square size={14} />}
              {allFilteredSelected ? 'Deselect all' : `Select all (${filtered.length})`}
            </button>
            {selected.size > 0 && (
              <span className="text-xs font-medium text-emerald-400">{selected.size} selected</span>
            )}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5 min-h-0">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm mb-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={24} className="animate-spin text-emerald-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14">
              <ClipboardList size={32} className="mx-auto text-gray-700 mb-3" />
              <p className="text-sm text-gray-500">
                {allCases.length === 0
                  ? 'All available test cases are already in this suite'
                  : 'No test cases match your filters'}
              </p>
            </div>
          ) : (
            filtered.map(tc => {
              const isSelected = selected.has(tc.id)
              return (
                <button
                  key={tc.id}
                  onClick={() => toggleOne(tc.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition group ${
                    isSelected
                      ? 'bg-emerald-900/20 border-emerald-700'
                      : 'bg-gray-800/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800'
                  }`}
                >
                  <div className={`shrink-0 transition ${isSelected ? 'text-emerald-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                    {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </div>
                  <span className={`flex-1 text-sm truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {tc.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[tc.priority] || ''}`}>
                      {tc.priority}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[tc.status] || ''}`}>
                      {tc.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 shrink-0">
          <p className="text-xs text-gray-500">
            {filtered.length} available · {alreadyAdded.length} already in suite
          </p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={selected.size === 0 || saving}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <PackagePlus size={14} />}
              Add {selected.size > 0 ? `${selected.size} ` : ''}Case{selected.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Suite Card ───────────────────────────────────────────────────────────────

interface SuiteCardProps {
  suite: Suite
  depth?: number
  onRefresh: () => void
  onEdit: (suite: Suite) => void
  onAddChild: (parentId: number) => void
}

function SuiteCard({ suite, depth = 0, onRefresh, onEdit, onAddChild }: SuiteCardProps) {
  const [expanded,      setExpanded]      = useState(depth === 0)
  const [casesExpanded, setCasesExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [pickerOpen,    setPickerOpen]    = useState(false)

  const totalCases = suite._count?.testCases ?? 0
  const hasChildren = suite.children?.length > 0

  const handleArchive = async () => {
    if (!confirm(`${suite.isArchived ? 'Restore' : 'Archive'} "${suite.name}"?`)) return
    setActionLoading(true)
    try {
      await api.put(`/test-suites/${suite.id}`, { isArchived: !suite.isArchived })
      onRefresh()
    } catch {
      alert('Failed to update suite')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Archive "${suite.name}"? This will hide it from the main view.`)) return
    setActionLoading(true)
    try {
      await api.delete(`/test-suites/${suite.id}`)
      onRefresh()
    } catch {
      alert('Failed to archive suite')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveCase = async (testCaseId: number) => {
    if (!confirm('Remove this test case from the suite?')) return
    try {
      await api.delete(`/test-suites/${suite.id}/test-cases/${testCaseId}`)
      onRefresh()
    } catch {
      alert('Failed to remove test case')
    }
  }

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l-2 border-gray-800 pl-4' : ''}`}>
      <div className={`bg-gray-900 border rounded-xl mb-3 overflow-hidden transition-all ${
        suite.isArchived ? 'border-gray-800 opacity-60' : 'border-gray-800 hover:border-gray-700'
      }`}>
        {/* Suite Header Row */}
        <div className="flex items-center gap-3 px-5 py-4">
          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gray-500 hover:text-white transition shrink-0"
          >
            {expanded
              ? <ChevronDown size={16} />
              : <ChevronRight size={16} />
            }
          </button>

          {/* Icon */}
          <div className={`p-2 rounded-lg shrink-0 ${suite.isArchived ? 'bg-gray-800' : 'bg-emerald-900/30'}`}>
            <Layers size={16} className={suite.isArchived ? 'text-gray-500' : 'text-emerald-400'} />
          </div>

          {/* Name & meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm truncate">{suite.name}</span>
              {suite.isArchived && (
                <span className="text-[10px] bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full">ARCHIVED</span>
              )}
              {suite.module && (
                <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{suite.module}</span>
              )}
            </div>
            {suite.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{suite.description}</p>
            )}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setCasesExpanded(e => !e)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-400 transition"
            >
              <ClipboardList size={13} />
              <span>{totalCases} test{totalCases !== 1 ? 's' : ''}</span>
            </button>
            {hasChildren && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <FolderOpen size={13} />
                {suite.children.length} sub-suite{suite.children.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setPickerOpen(true)}
              title="Add test cases to suite"
              className="p-1.5 text-gray-400 hover:text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition"
            >
              <PackagePlus size={15} />
            </button>
            <button
              onClick={() => onAddChild(suite.id)}
              title="Add child suite"
              className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-900/20 rounded-lg transition"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => onEdit(suite)}
              title="Edit suite"
              className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={handleArchive}
              disabled={actionLoading}
              title={suite.isArchived ? 'Restore suite' : 'Archive suite'}
              className="p-1.5 text-gray-400 hover:text-yellow-400 hover:bg-yellow-900/20 rounded-lg transition disabled:opacity-40"
            >
              {suite.isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
            </button>
            <button
              onClick={handleDelete}
              disabled={actionLoading}
              title="Delete suite"
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition disabled:opacity-40"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* Test Cases List */}
        {expanded && casesExpanded && suite.testCases?.length > 0 && (
          <div className="border-t border-gray-800 px-5 py-3 space-y-2 bg-gray-950/50">
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2">Test Cases</p>
            {suite.testCases
              .sort((a, b) => a.order - b.order)
              .map(({ testCase }) => (
                <div
                  key={testCase.id}
                  className="flex items-center gap-3 p-2.5 bg-gray-900 rounded-lg border border-gray-800 group"
                >
                  <ClipboardList size={13} className="text-gray-500 shrink-0" />
                  <span className="text-sm text-gray-300 flex-1 truncate">{testCase.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[testCase.priority] || ''}`}>
                    {testCase.priority}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[testCase.status] || ''}`}>
                    {testCase.status?.replace(/_/g, ' ')}
                  </span>
                  <button
                    onClick={() => handleRemoveCase(testCase.id)}
                    className="p-1 text-gray-600 hover:text-red-400 rounded transition opacity-0 group-hover:opacity-100"
                    title="Remove from suite"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Empty test cases state */}
        {expanded && casesExpanded && suite.testCases?.length === 0 && (
          <div className="border-t border-gray-800 px-5 py-6 text-center bg-gray-950/30">
            <ClipboardList size={24} className="mx-auto text-gray-700 mb-2" />
            <p className="text-xs text-gray-600 mb-2">No test cases in this suite yet</p>
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-emerald-500 hover:text-emerald-400 transition"
            >
              <PackagePlus size={13} /> Add test cases
            </button>
          </div>
        )}
      </div>

      {/* Recursive children */}
      {expanded && hasChildren && suite.children.map(child => (
        <SuiteCard
          key={child.id}
          suite={child}
          depth={depth + 1}
          onRefresh={onRefresh}
          onEdit={onEdit}
          onAddChild={onAddChild}
        />
      ))}

      {/* Test Case Picker Modal */}
      {pickerOpen && (
        <TestCasePickerModal
          suiteId={suite.id}
          suiteName={suite.name}
          alreadyAdded={suite.testCases?.map(i => i.testCaseId) ?? []}
          onClose={() => setPickerOpen(false)}
          onSaved={onRefresh}
        />
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestSuites() {
  const [suites,       setSuites]       = useState<Suite[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [search,       setSearch]       = useState('')

  // Modal state
  const [modalOpen,    setModalOpen]    = useState(false)
  const [editTarget,   setEditTarget]   = useState<Suite | undefined>()
  const [parentId,     setParentId]     = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/test-suites', {
        params: { archived: showArchived }
      })
      setSuites(data)
    } catch {
      setError('Failed to load test suites')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [showArchived])

  const openCreate = () => {
    setEditTarget(undefined)
    setParentId(null)
    setModalOpen(true)
  }

  const openEdit = (suite: Suite) => {
    setEditTarget(suite)
    setParentId(null)
    setModalOpen(true)
  }

  const openAddChild = (pId: number) => {
    setEditTarget(undefined)
    setParentId(pId)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditTarget(undefined)
    setParentId(null)
  }

  // Client-side search filter
  const filtered = search.trim()
    ? suites.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.module?.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase())
      )
    : suites

  const totalCases = suites.reduce((acc, s) => acc + (s._count?.testCases ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-900/30 rounded-xl">
              <Layers size={24} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Test Suites</h1>
              <p className="text-sm text-gray-400">
                {suites.length} suite{suites.length !== 1 ? 's' : ''} · {totalCases} test cases
              </p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition"
          >
            <Plus size={18} /> New Suite
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search suites..."
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          {/* Toggle archived */}
          <button
            onClick={() => setShowArchived(a => !a)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition ${
              showArchived
                ? 'bg-yellow-900/20 border-yellow-800 text-yellow-300'
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Archive size={15} />
            {showArchived ? 'Showing Archived' : 'Show Archived'}
          </button>

          {/* Refresh */}
          <button
            onClick={load}
            disabled={loading}
            className="p-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl transition disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl mb-5 text-red-300 text-sm">
            <AlertCircle size={16} /> {error}
            <button onClick={load} className="ml-auto flex items-center gap-1 hover:text-red-200 text-xs">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center py-28">
            <RefreshCw size={30} className="animate-spin text-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-28">
            <div className="inline-flex p-5 bg-gray-900 rounded-2xl mb-5 border border-gray-800">
              <Layers size={40} className="text-gray-700" />
            </div>
            <p className="text-lg text-gray-500 font-medium">
              {search ? 'No suites match your search' : showArchived ? 'No archived suites' : 'No test suites yet'}
            </p>
            {!search && !showArchived && (
              <button
                onClick={openCreate}
                className="mt-5 px-6 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition"
              >
                Create your first suite
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Total Suites',     value: suites.length,  color: 'text-emerald-400' },
                { label: 'Total Test Cases', value: totalCases,     color: 'text-blue-400' },
                {
                  label: 'With Children',
                  value: suites.filter(s => s.children?.length > 0).length,
                  color: 'text-purple-400'
                },
              ].map(stat => (
                <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Suite tree */}
            <div className="space-y-1">
              {filtered.map(suite => (
                <SuiteCard
                  key={suite.id}
                  suite={suite}
                  depth={0}
                  onRefresh={load}
                  onEdit={openEdit}
                  onAddChild={openAddChild}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <SuiteFormModal
          initial={editTarget}
          parentId={parentId}
          onClose={closeModal}
          onSaved={load}
        />
      )}
    </div>
  )
}