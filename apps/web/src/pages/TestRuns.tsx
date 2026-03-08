import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import {
  Plus, PlayCircle, RefreshCw, AlertCircle, X, Search,
  ListFilter, Pencil, Calendar, CheckCircle2, XCircle,
  MinusCircle, SkipForward, Clock, ChevronRight, Flag,
  BarChart3, User, Target, Ban
} from 'lucide-react'

interface Milestone { id: number; name: string }
interface Creator   { id: number; name: string }

interface ExecutionSummary {
  PASS?: number; FAIL?: number; BLOCKED?: number
  SKIPPED?: number; IN_PROGRESS?: number
}

interface Execution {
  id: number; status: string; startedAt: string; completedAt?: string
  testCase: { id: number; title: string; priority: string; module?: string }
  tester:   { id: number; name: string }
}

interface TestRun {
  id: number; name: string; description?: string
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED'
  startDate?: string; endDate?: string
  creator: Creator; milestone?: Milestone
  executions?: Execution[]
  statusBreakdown?: ExecutionSummary
  _count?: { executions: number }
}

const RUN_STATUS_META: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PLANNED:     { label: 'Planned',     color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',     icon: <Clock size={13} /> },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',   icon: <PlayCircle size={13} /> },
  COMPLETED:   { label: 'Completed',   color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={13} /> },
  ABORTED:     { label: 'Aborted',     color: 'text-red-600',     bg: 'bg-red-50 border-red-200',       icon: <Ban size={13} /> },
}

const EXEC_STATUS_META: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  PASS:        { color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: <CheckCircle2 size={12} /> },
  FAIL:        { color: 'text-red-600',     bg: 'bg-red-50',      icon: <XCircle size={12} /> },
  BLOCKED:     { color: 'text-orange-600',  bg: 'bg-orange-50',   icon: <MinusCircle size={12} /> },
  SKIPPED:     { color: 'text-gray-500',    bg: 'bg-gray-100',    icon: <SkipForward size={12} /> },
  IN_PROGRESS: { color: 'text-amber-600',   bg: 'bg-amber-50',    icon: <Clock size={12} /> },
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW:      'bg-gray-100 text-gray-600 border border-gray-200',
  MEDIUM:   'bg-blue-50 text-blue-700 border border-blue-200',
  HIGH:     'bg-orange-50 text-orange-700 border border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border border-red-200',
}

const VALID_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ABORTED']

function fmtDate(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function calcPassRate(breakdown?: ExecutionSummary): number {
  if (!breakdown) return 0
  const total = Object.values(breakdown).reduce((a, b) => a + (b ?? 0), 0)
  if (total === 0) return 0
  return Math.round(((breakdown.PASS ?? 0) / total) * 100)
}

function totalExecs(breakdown?: ExecutionSummary): number {
  if (!breakdown) return 0
  return Object.values(breakdown).reduce((a, b) => a + (b ?? 0), 0)
}

function ProgressBar({ breakdown }: { breakdown?: ExecutionSummary }) {
  const total = totalExecs(breakdown)
  if (total === 0) return <div className="h-1.5 bg-gray-200 rounded-full w-full" />
  const segments = [
    { key: 'PASS',        color: 'bg-emerald-500' },
    { key: 'FAIL',        color: 'bg-red-500' },
    { key: 'BLOCKED',     color: 'bg-orange-400' },
    { key: 'SKIPPED',     color: 'bg-gray-300' },
    { key: 'IN_PROGRESS', color: 'bg-amber-400' },
  ]
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full gap-px">
      {segments.map(({ key, color }) => {
        const val = (breakdown as any)?.[key] ?? 0
        if (val === 0) return null
        return <div key={key} className={`${color} transition-all`} style={{ width: `${(val / total) * 100}%` }} />
      })}
    </div>
  )
}

// ─── Run Form Modal ───────────────────────────────────────────────────────────

interface RunFormProps {
  initial?:    TestRun
  milestones:  Milestone[]
  projectId?:  string | null
  onClose:     () => void
  onSaved:     () => void
}

function RunFormModal({ initial, milestones, projectId, onClose, onSaved }: RunFormProps) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState({
    name:        initial?.name        || '',
    description: initial?.description || '',
    status:      initial?.status      || 'PLANNED',
    startDate:   initial?.startDate   ? initial.startDate.slice(0, 10) : '',
    endDate:     initial?.endDate     ? initial.endDate.slice(0, 10)   : '',
    milestoneId: initial?.milestone?.id?.toString() || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Run name is required'); return }
    if (!isEdit && !projectId) { setError('No project selected — open from a project page'); return }
    setSaving(true); setError('')
    try {
      const payload: Record<string, any> = {
        name:        form.name.trim(),
        description: form.description.trim() || undefined,
        startDate:   form.startDate || undefined,
        endDate:     form.endDate   || undefined,
        milestoneId: form.milestoneId ? parseInt(form.milestoneId) : undefined,
      }
      if (isEdit) {
        payload.status = form.status
        await api.put(`/test-runs/${initial!.id}`, payload)
      } else {
        payload.projectId = parseInt(projectId!)
        await api.post('/test-runs', payload)
      }
      onSaved(); onClose()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save test run')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100 rounded-lg">
              <PlayCircle size={18} className="text-emerald-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              {isEdit ? 'Edit Test Run' : 'New Test Run'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition p-1"><X size={20} /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {!isEdit && !projectId && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
              <AlertCircle size={14} /> Open from a project to create a test run
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Run Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Sprint 5 Regression" className={inp} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="What does this test run cover?" rows={2}
              className={`${inp} resize-none`} />
          </div>

          {isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value)} className={inp}>
                {VALID_STATUSES.map(s => <option key={s} value={s}>{RUN_STATUS_META[s]?.label ?? s}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">End Date</label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} className={inp} />
            </div>
          </div>

          {milestones.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                <span className="flex items-center gap-1.5"><Flag size={12} /> Milestone</span>
              </label>
              <select value={form.milestoneId} onChange={e => set('milestoneId', e.target.value)} className={inp}>
                <option value="">No milestone</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow-sm">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <PlayCircle size={14} />}
            {isEdit ? 'Save Changes' : 'Create Run'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Run Detail Drawer ────────────────────────────────────────────────────────

interface RunDetailProps {
  run:     TestRun
  onClose: () => void
  onEdit:  () => void
}

function RunDetailDrawer({ run, onClose, onEdit }: RunDetailProps) {
  const [detail,  setDetail]  = useState<TestRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    const fetch = async () => {
      setLoading(true); setError('')
      try {
        const { data } = await api.get(`/test-runs/${run.id}`)
        setDetail(data)
      } catch { setError('Failed to load run details') }
      finally { setLoading(false) }
    }
    fetch()
  }, [run.id])

  const passRate  = calcPassRate(run.statusBreakdown)
  const execTotal = totalExecs(run.statusBreakdown)
  const meta      = RUN_STATUS_META[run.status]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
      <div className="bg-white border-l border-gray-200 w-full max-w-xl h-full flex flex-col shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${meta.color} ${meta.bg}`}>
                {meta.icon} {meta.label}
              </span>
              {run.milestone && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">
                  <Flag size={11} /> {run.milestone.name}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 truncate">{run.name}</h2>
            {run.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{run.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onEdit} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit run">
              <Pencil size={15} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 shrink-0 bg-gray-50">
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { label: 'Pass',    val: run.statusBreakdown?.PASS    ?? 0, color: 'text-emerald-600', bg: 'bg-white border-emerald-200' },
              { label: 'Fail',    val: run.statusBreakdown?.FAIL    ?? 0, color: 'text-red-600',     bg: 'bg-white border-red-200' },
              { label: 'Blocked', val: run.statusBreakdown?.BLOCKED ?? 0, color: 'text-orange-600',  bg: 'bg-white border-orange-200' },
              { label: 'Skipped', val: run.statusBreakdown?.SKIPPED ?? 0, color: 'text-gray-500',    bg: 'bg-white border-gray-200' },
            ].map(s => (
              <div key={s.label} className={`border rounded-xl px-3 py-2.5 text-center shadow-sm ${s.bg}`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <ProgressBar breakdown={run.statusBreakdown} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{execTotal} execution{execTotal !== 1 ? 's' : ''}</span>
              <span className={`text-xs font-semibold ${passRate >= 80 ? 'text-emerald-600' : passRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                {passRate}% pass rate
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <User size={12} className="text-gray-400" />
              Created by <span className="text-gray-700 ml-0.5 font-medium">{run.creator?.name}</span>
            </span>
            {run.startDate && (
              <span className="flex items-center gap-1.5">
                <Calendar size={12} className="text-gray-400" />
                Start: <span className="text-gray-700 ml-0.5 font-medium">{fmtDate(run.startDate)}</span>
              </span>
            )}
            {run.endDate && (
              <span className="flex items-center gap-1.5">
                <Target size={12} className="text-gray-400" />
                Target: <span className="text-gray-700 ml-0.5 font-medium">{fmtDate(run.endDate)}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 bg-gray-50">
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-3 font-semibold">Executions</p>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={22} className="animate-spin text-emerald-500" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          ) : !detail?.executions?.length ? (
            <div className="text-center py-12">
              <BarChart3 size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No executions in this run yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {detail.executions.map(ex => {
                const exMeta = EXEC_STATUS_META[ex.status] ?? EXEC_STATUS_META.IN_PROGRESS
                return (
                  <div key={ex.id}
                    className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition shadow-sm">
                    <div className={`shrink-0 p-1.5 rounded-lg ${exMeta.bg}`}>
                      <span className={exMeta.color}>{exMeta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate font-medium">{ex.testCase.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {ex.testCase.module && <span className="text-[10px] text-gray-400">{ex.testCase.module}</span>}
                        <span className="text-[10px] text-gray-300">·</span>
                        <span className="text-[10px] text-gray-400">{ex.tester?.name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[ex.testCase.priority] || ''}`}>
                        {ex.testCase.priority}
                      </span>
                      <span className="text-[10px] text-gray-400">{fmtDate(ex.startedAt)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Run Card ─────────────────────────────────────────────────────────────────

interface RunCardProps {
  run:    TestRun
  onEdit: (run: TestRun) => void
  onView: (run: TestRun) => void
}

function RunCard({ run, onEdit, onView }: RunCardProps) {
  const meta      = RUN_STATUS_META[run.status] ?? RUN_STATUS_META.PLANNED
  const passRate  = calcPassRate(run.statusBreakdown)
  const execTotal = totalExecs(run.statusBreakdown)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-md transition group shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium ${meta.color} ${meta.bg}`}>
              {meta.icon} {meta.label}
            </span>
            {run.milestone && (
              <span className="inline-flex items-center gap-1 text-xs text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                <Flag size={10} /> {run.milestone.name}
              </span>
            )}
          </div>
          <h3 className="text-base font-semibold text-gray-900 truncate">{run.name}</h3>
          {run.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{run.description}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition">
          <button onClick={() => onEdit(run)} title="Edit"
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
            <Pencil size={14} />
          </button>
          <button onClick={() => onView(run)} title="View detail"
            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="mb-3 space-y-1.5">
        <ProgressBar breakdown={run.statusBreakdown} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            {execTotal > 0 ? (
              <>
                {(run.statusBreakdown?.PASS    ?? 0) > 0 && <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={11} /> {run.statusBreakdown?.PASS}</span>}
                {(run.statusBreakdown?.FAIL    ?? 0) > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle size={11} /> {run.statusBreakdown?.FAIL}</span>}
                {(run.statusBreakdown?.BLOCKED ?? 0) > 0 && <span className="flex items-center gap-1 text-orange-500"><MinusCircle size={11} /> {run.statusBreakdown?.BLOCKED}</span>}
              </>
            ) : <span className="text-gray-300">No executions yet</span>}
          </div>
          {execTotal > 0 && (
            <span className={`text-xs font-bold ${passRate >= 80 ? 'text-emerald-600' : passRate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {passRate}%
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><User size={11} /> {run.creator?.name}</span>
          {run.startDate && <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(run.startDate)}</span>}
          {run.endDate   && <span className="flex items-center gap-1"><Target size={11} /> {fmtDate(run.endDate)}</span>}
        </div>
        <button onClick={() => onView(run)} className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-1 transition font-medium">
          View <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestRuns() {
  const [searchParams]     = useSearchParams()
  const projectId          = searchParams.get('projectId')

  const [runs,         setRuns]         = useState<TestRun[]>([])
  const [milestones,   setMilestones]   = useState<Milestone[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formOpen,   setFormOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState<TestRun | undefined>()
  const [viewTarget, setViewTarget] = useState<TestRun | undefined>()

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params: Record<string, string> = {}
      if (projectId)    params.projectId = projectId
      if (statusFilter) params.status    = statusFilter

      const [runsRes, msRes] = await Promise.all([
        api.get('/test-runs', { params }),
        api.get('/milestones').catch(() => ({ data: [] }))
      ])
      setRuns(runsRes.data)
      setMilestones(msRes.data)
    } catch {
      setError('Failed to load test runs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [statusFilter, projectId])

  const openCreate = () => { setEditTarget(undefined); setFormOpen(true) }
  const openEdit   = (run: TestRun) => { setEditTarget(run); setViewTarget(undefined); setFormOpen(true) }
  const openView   = (run: TestRun) => setViewTarget(run)

  const filtered = search.trim()
    ? runs.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        r.milestone?.name.toLowerCase().includes(search.toLowerCase())
      )
    : runs

  const counts = VALID_STATUSES.reduce((acc, s) => {
    acc[s] = runs.filter(r => r.status === s).length
    return acc
  }, {} as Record<string, number>)

  // Summary card accent styles (light)
  const CARD_ACCENTS: Record<string, { num: string; border: string; activeBg: string }> = {
    PLANNED:     { num: 'text-blue-600',    border: 'border-blue-200',    activeBg: 'bg-blue-50' },
    IN_PROGRESS: { num: 'text-amber-600',   border: 'border-amber-200',   activeBg: 'bg-amber-50' },
    COMPLETED:   { num: 'text-emerald-600', border: 'border-emerald-200', activeBg: 'bg-emerald-50' },
    ABORTED:     { num: 'text-red-500',     border: 'border-red-200',     activeBg: 'bg-red-50' },
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <PlayCircle size={24} className="text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Test Runs</h1>
              <p className="text-sm text-gray-500">
                {runs.length} run{runs.length !== 1 ? 's' : ''} total
                {projectId && <span className="ml-2 text-emerald-600 text-xs font-medium">· Project #{projectId}</span>}
              </p>
            </div>
          </div>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition shadow-sm">
            <Plus size={18} /> New Run
          </button>
        </div>

        {/* Status summary cards */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {VALID_STATUSES.map(s => {
            const m       = RUN_STATUS_META[s]
            const acc     = CARD_ACCENTS[s]
            const isActive = statusFilter === s
            return (
              <button key={s} onClick={() => setStatusFilter(isActive ? '' : s)}
                className={`text-left p-4 rounded-xl border transition shadow-sm ${
                  isActive
                    ? `${acc.activeBg} ${acc.border}`
                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={m.color}>{m.icon}</span>
                  <span className={`text-2xl font-bold ${acc.num}`}>{counts[s] ?? 0}</span>
                </div>
                <p className="text-xs text-gray-500 font-medium">{m.label}</p>
              </button>
            )
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search runs..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition shadow-sm" />
          </div>
          {statusFilter && (
            <button onClick={() => setStatusFilter('')}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 hover:bg-emerald-100 transition font-medium">
              <ListFilter size={13} /> {RUN_STATUS_META[statusFilter]?.label} <X size={12} />
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="p-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-700 rounded-xl transition disabled:opacity-40 shadow-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {!projectId && (
          <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-amber-700 text-sm">
            <AlertCircle size={16} /> No project selected — open from a project to see its test runs.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 text-red-600 text-sm">
            <AlertCircle size={16} /> {error}
            <button onClick={load} className="ml-auto flex items-center gap-1 text-xs font-semibold hover:text-red-700">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-28">
            <RefreshCw size={30} className="animate-spin text-emerald-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-28">
            <div className="inline-flex p-5 bg-white rounded-2xl mb-5 border border-gray-200 shadow-sm">
              <PlayCircle size={40} className="text-gray-300" />
            </div>
            <p className="text-lg text-gray-500 font-medium">
              {search ? 'No runs match your search' : statusFilter ? `No ${RUN_STATUS_META[statusFilter]?.label.toLowerCase()} runs` : 'No test runs yet'}
            </p>
            {!search && !statusFilter && (
              <button onClick={openCreate}
                className="mt-5 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition shadow-sm">
                Create your first test run
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(run => (
              <RunCard key={run.id} run={run} onEdit={openEdit} onView={openView} />
            ))}
          </div>
        )}
      </div>

      {formOpen && (
        <RunFormModal
          initial={editTarget}
          milestones={milestones}
          projectId={projectId}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}

      {viewTarget && (
        <RunDetailDrawer
          run={viewTarget}
          onClose={() => setViewTarget(undefined)}
          onEdit={() => openEdit(viewTarget)}
        />
      )}
    </div>
  )
}