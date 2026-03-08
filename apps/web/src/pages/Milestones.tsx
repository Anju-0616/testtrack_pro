import { useEffect, useState } from 'react'
import api from '../lib/api'
import {
  Flag, Plus, RefreshCw, AlertCircle, X, Search,
  Pencil, Calendar, CheckCircle2, Clock, PlayCircle,
  ChevronRight, Target, User, BarChart3
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestRun {
  id: number
  name: string
  status: string
  _count: { executions: number }
}

interface Milestone {
  id: number
  name: string
  description?: string
  targetDate: string
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'
  creator: { id: number; name: string }
  _count?: { testRuns: number }
  testRuns?: TestRun[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PLANNED:     { label: 'Planned',     color: 'text-blue-300',    bg: 'bg-blue-900/40 border-blue-800',     icon: <Clock size={13} /> },
  IN_PROGRESS: { label: 'In Progress', color: 'text-yellow-300',  bg: 'bg-yellow-900/40 border-yellow-800', icon: <PlayCircle size={13} /> },
  COMPLETED:   { label: 'Completed',   color: 'text-emerald-300', bg: 'bg-emerald-900/40 border-emerald-800',icon: <CheckCircle2 size={13} /> },
}

const VALID_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysUntil(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  return diff
}

function DaysChip({ targetDate, status }: { targetDate: string; status: string }) {
  if (status === 'COMPLETED') return null
  const days = daysUntil(targetDate)
  if (days < 0)  return <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-xs text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded-full">Due today</span>
  if (days <= 7)  return <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">{days}d left</span>
  return <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{days}d left</span>
}

// ─── Milestone Form Modal ─────────────────────────────────────────────────────

interface FormProps {
  initial?: Milestone
  onClose: () => void
  onSaved: () => void
}

function MilestoneFormModal({ initial, onClose, onSaved }: FormProps) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    name:        initial?.name        || '',
    description: initial?.description || '',
    targetDate:  initial?.targetDate  ? initial.targetDate.slice(0, 10) : '',
    status:      initial?.status      || 'PLANNED',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim())    { setError('Name is required');        return }
    if (!form.targetDate)     { setError('Target date is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, any> = {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        targetDate:  form.targetDate,
      }
      if (isEdit) {
        payload.status = form.status
        await api.put(`/milestones/${initial!.id}`, payload)
      } else {
        await api.post('/milestones', payload)
      }
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save milestone')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-900/30 rounded-lg">
              <Flag size={16} className="text-purple-400" />
            </div>
            <h2 className="text-base font-semibold text-white">
              {isEdit ? 'Edit Milestone' : 'New Milestone'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition p-1">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Beta Release v1.0"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="What does this milestone represent?"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Target Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={form.targetDate}
              onChange={e => set('targetDate', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition [color-scheme:dark]"
            />
          </div>

          {/* Status — edit only, backend accepts it on PUT */}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Status</label>
              <select
                value={form.status}
                onChange={e => set('status', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 transition"
              >
                {VALID_STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Flag size={14} />}
            {isEdit ? 'Save Changes' : 'Create Milestone'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function MilestoneDrawer({ milestone, onClose, onEdit }: {
  milestone: Milestone
  onClose: () => void
  onEdit: () => void
}) {
  const [detail,  setDetail]  = useState<Milestone | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const { data } = await api.get(`/milestones/${milestone.id}`)
        setDetail(data)
      } catch {
        setError('Failed to load milestone details')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [milestone.id])

  const sm = STATUS_META[milestone.status]

  const RUN_STATUS_COLORS: Record<string, string> = {
    PLANNED:     'text-blue-300 bg-blue-900/30',
    IN_PROGRESS: 'text-yellow-300 bg-yellow-900/30',
    COMPLETED:   'text-emerald-300 bg-emerald-900/30',
    ABORTED:     'text-red-300 bg-red-900/30',
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border-l border-gray-800 w-full max-w-lg h-full flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-800 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${sm.color} ${sm.bg}`}>
                {sm.icon} {sm.label}
              </span>
              <DaysChip targetDate={milestone.targetDate} status={milestone.status} />
            </div>
            <h2 className="text-lg font-bold text-white">{milestone.name}</h2>
            {milestone.description && (
              <p className="text-sm text-gray-400 mt-0.5">{milestone.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onEdit}
              className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition">
              <Pencil size={15} />
            </button>
            <button onClick={onClose}
              className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-6 py-3 border-b border-gray-800 shrink-0 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <Calendar size={12} className="text-gray-600" />
            Target: <span className="text-gray-300 ml-0.5">{fmtDate(milestone.targetDate)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <User size={12} className="text-gray-600" />
            Created by <span className="text-gray-300 ml-0.5">{milestone.creator?.name}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <BarChart3 size={12} className="text-gray-600" />
            {milestone._count?.testRuns ?? 0} test run{(milestone._count?.testRuns ?? 0) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Test Runs */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-3 font-medium">Linked Test Runs</p>

          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw size={22} className="animate-spin text-purple-400" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400 flex items-center gap-2"><AlertCircle size={14} />{error}</p>
          ) : !detail?.testRuns?.length ? (
            <div className="text-center py-12">
              <BarChart3 size={28} className="mx-auto text-gray-700 mb-2" />
              <p className="text-sm text-gray-600">No test runs linked to this milestone</p>
            </div>
          ) : (
            <div className="space-y-2">
              {detail.testRuns.map(run => (
                <div key={run.id}
                  className="flex items-center gap-3 p-3 bg-gray-800/60 border border-gray-800 rounded-xl hover:border-gray-700 transition">
                  <PlayCircle size={14} className="text-gray-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{run.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{run._count.executions} execution{run._count.executions !== 1 ? 's' : ''}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${RUN_STATUS_COLORS[run.status] || 'text-gray-400 bg-gray-800'}`}>
                    {run.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Milestone Card ───────────────────────────────────────────────────────────

function MilestoneCard({ milestone, onEdit, onView }: {
  milestone: Milestone
  onEdit: (m: Milestone) => void
  onView: (m: Milestone) => void
}) {
  const sm      = STATUS_META[milestone.status]
  const runCount = milestone._count?.testRuns ?? 0

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition group">

      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${sm.color} ${sm.bg}`}>
              {sm.icon} {sm.label}
            </span>
            <DaysChip targetDate={milestone.targetDate} status={milestone.status} />
          </div>
          <h3 className="text-base font-semibold text-white truncate">{milestone.name}</h3>
          {milestone.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{milestone.description}</p>
          )}
        </div>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onEdit(milestone)}
            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded-lg transition">
            <Pencil size={14} />
          </button>
          <button onClick={() => onView(milestone)}
            className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-900/20 rounded-lg transition">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-800">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={11} /> {fmtDate(milestone.targetDate)}
          </span>
          <span className="flex items-center gap-1.5">
            <Target size={11} /> {runCount} run{runCount !== 1 ? 's' : ''}
          </span>
          {milestone.creator && (
            <span className="flex items-center gap-1.5">
              <User size={11} /> {milestone.creator.name}
            </span>
          )}
        </div>
        <button onClick={() => onView(milestone)}
          className="text-xs text-gray-500 hover:text-purple-400 flex items-center gap-1 transition">
          View <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Milestones() {
  const [milestones,   setMilestones]   = useState<Milestone[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formOpen,   setFormOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<Milestone | undefined>()
  const [viewTarget, setViewTarget] = useState<Milestone | undefined>()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/milestones')
      setMilestones(data)
    } catch {
      setError('Failed to load milestones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditTarget(undefined); setFormOpen(true) }
  const openEdit   = (m: Milestone) => { setEditTarget(m); setViewTarget(undefined); setFormOpen(true) }
  const openView   = (m: Milestone) => setViewTarget(m)

  // Client-side filter
  const filtered = milestones.filter(m => {
    const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.description?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || m.status === statusFilter
    return matchSearch && matchStatus
  })

  // Summary counts
  const counts = VALID_STATUSES.reduce((acc, s) => {
    acc[s] = milestones.filter(m => m.status === s).length
    return acc
  }, {} as Record<string, number>)

  const overdueCount = milestones.filter(m => m.status !== 'COMPLETED' && daysUntil(m.targetDate) < 0).length

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-900/30 rounded-xl">
              <Flag size={24} className="text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Milestones</h1>
              <p className="text-sm text-gray-400">{milestones.length} total{overdueCount > 0 && <span className="text-red-400 ml-2">· {overdueCount} overdue</span>}</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-xl transition"
          >
            <Plus size={18} /> New Milestone
          </button>
        </div>

        {/* Status summary cards — also act as filters */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {VALID_STATUSES.map(s => {
            const m        = STATUS_META[s]
            const isActive = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(isActive ? '' : s)}
                className={`text-left p-4 rounded-xl border transition ${
                  isActive ? `${m.bg} border-opacity-100` : 'bg-gray-900 border-gray-800 hover:border-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={m.color}>{m.icon}</span>
                  <span className={`text-xl font-bold ${m.color}`}>{counts[s] ?? 0}</span>
                </div>
                <p className="text-xs text-gray-500">{m.label}</p>
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search milestones…"
              className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition"
            />
          </div>

          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-purple-900/30 border border-purple-800 rounded-xl text-xs text-purple-300 hover:bg-purple-900/50 transition"
            >
              {STATUS_META[statusFilter]?.label}
              <X size={12} />
            </button>
          )}

          <button onClick={load} disabled={loading}
            className="p-2.5 bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl transition disabled:opacity-40">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl mb-5 text-red-300 text-sm">
            <AlertCircle size={15} /> {error}
            <button onClick={load} className="ml-auto text-xs flex items-center gap-1">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-28">
            <RefreshCw size={30} className="animate-spin text-purple-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-28">
            <div className="inline-flex p-5 bg-gray-900 rounded-2xl mb-5 border border-gray-800">
              <Flag size={40} className="text-gray-700" />
            </div>
            <p className="text-lg text-gray-500 font-medium">
              {search || statusFilter ? 'No milestones match your filters' : 'No milestones yet'}
            </p>
            {!search && !statusFilter && (
              <button onClick={openCreate}
                className="mt-5 px-6 py-2.5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-sm font-medium transition">
                Create your first milestone
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(m => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                onEdit={openEdit}
                onView={openView}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      {formOpen && (
        <MilestoneFormModal
          initial={editTarget}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}

      {/* Detail drawer */}
      {viewTarget && (
        <MilestoneDrawer
          milestone={viewTarget}
          onClose={() => setViewTarget(undefined)}
          onEdit={() => openEdit(viewTarget)}
        />
      )}
    </div>
  )
}