import { useEffect, useState } from 'react'
import api from '../lib/api'
import {
  Bug, RefreshCw, AlertCircle, Search, ListFilter, X,
  MessageSquare, Clock, GitCommit, CheckCheck,
  ChevronDown, Send, Pencil, Trash2, Info
} from 'lucide-react'

interface Comment {
  id: number; content: string; createdAt: string
  user: { id: number; email: string; role: string }
}
interface BugItem {
  id: number; bugId: string; title: string; description: string
  stepsToReproduce?: string; expectedBehavior?: string; actualBehavior?: string
  priority: string; severity: string; status: string
  environment?: string; affectedVersion?: string
  ageInDays: number; createdAt: string
  fixNotes?: string; commitHash?: string; branchName?: string
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW:         { label: 'New',         color: 'text-gray-600',    bg: 'bg-gray-100 border-gray-200' },
  OPEN:        { label: 'Open',        color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  FIXED:       { label: 'Fixed',       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  VERIFIED:    { label: 'Verified',    color: 'text-teal-600',    bg: 'bg-teal-50 border-teal-200' },
  CLOSED:      { label: 'Closed',      color: 'text-gray-500',    bg: 'bg-gray-50 border-gray-200' },
  REOPENED:    { label: 'Reopened',    color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  WONT_FIX:    { label: "Won't Fix",   color: 'text-gray-500',    bg: 'bg-gray-100 border-gray-200' },
  DUPLICATE:   { label: 'Duplicate',   color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-200' },
}
const SEV_CLS: Record<string, string> = {
  BLOCKER:  'text-red-600 bg-red-50 border border-red-100',
  CRITICAL: 'text-orange-600 bg-orange-50 border border-orange-100',
  MAJOR:    'text-amber-600 bg-amber-50 border border-amber-100',
  MINOR:    'text-blue-600 bg-blue-50 border border-blue-100',
  TRIVIAL:  'text-gray-500 bg-gray-100',
}
const PRI_CLS: Record<string, string> = {
  P1_URGENT: 'text-red-500 font-bold', P2_HIGH: 'text-orange-500 font-bold',
  P3_MEDIUM: 'text-amber-500 font-bold', P4_LOW: 'text-gray-400',
}
const ageColor = (d: number) => d >= 7 ? 'text-red-500' : d >= 3 ? 'text-orange-500' : 'text-gray-400'

// Developer can only act on OPEN, IN_PROGRESS, REOPENED
// NEW bugs must first be triaged (accepted) by a tester → OPEN
const DEV_TRANSITIONS: Record<string, { toStatus: string; label: string; cls: string; fixNotes: boolean }[]> = {
  OPEN:        [{ toStatus: 'IN_PROGRESS', label: 'Start Work',  cls: 'bg-amber-500 hover:bg-amber-600 text-white',    fixNotes: false }],
  IN_PROGRESS: [{ toStatus: 'FIXED',      label: 'Mark Fixed',  cls: 'bg-emerald-500 hover:bg-emerald-600 text-white', fixNotes: true  }],
  REOPENED:    [{ toStatus: 'IN_PROGRESS', label: 'Start Again', cls: 'bg-amber-500 hover:bg-amber-600 text-white',    fixNotes: false }],
}

// Statuses where dev is waiting on tester action
const WAITING_ON_TESTER: Record<string, string> = {
  NEW:      'Awaiting tester review before you can start work',
  FIXED:    'Awaiting tester verification',
  VERIFIED: 'Awaiting tester to close',
  CLOSED:   'Bug is closed',
  WONT_FIX: "Marked as Won't Fix",
  DUPLICATE:'Marked as Duplicate',
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// ─── Fix Notes Modal ──────────────────────────────────────────────────────────

function FixNotesModal({ bugId, onClose, onDone }: { bugId: number; onClose: () => void; onDone: () => void }) {
  const [fixNotes, setFixNotes] = useState('')
  const [commitHash, setCommitHash] = useState('')
  const [branchName, setBranchName] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!fixNotes.trim()) { setErr('Fix notes are required'); return }
    setSaving(true); setErr('')
    try {
      await api.patch(`/bugs/${bugId}/status`, { status: 'FIXED', fixNotes, commitHash, branchName })
      onDone(); onClose()
    } catch (e: any) { setErr(e?.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const inp = 'w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-100 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <CheckCheck size={16} className="text-emerald-500" /> Mark as Fixed
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11}/>{err}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Fix Notes <span className="text-red-400">*</span></label>
            <textarea value={fixNotes} onChange={e => setFixNotes(e.target.value)} placeholder="Describe the fix applied…" rows={3} className={`${inp} resize-none`}/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Commit Hash</label>
            <input value={commitHash} onChange={e => setCommitHash(e.target.value)} placeholder="abc123def" className={inp}/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Branch Name</label>
            <input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="fix/login-validation" className={inp}/>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={submit} disabled={saving || !fixNotes.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition">
            {saving ? <RefreshCw size={13} className="animate-spin"/> : <CheckCheck size={13}/>} Submit Fix
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Comment Panel ────────────────────────────────────────────────────────────

function CommentPanel({ bug, currentUserId, onClose }: { bug: BugItem; currentUserId: number; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    try { const { data } = await api.get(`/bugs/${bug.id}/comments`); setComments(Array.isArray(data) ? data : data.comments ?? []) }
    catch { setErr('Failed to load') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [bug.id])

  const send = async () => {
    if (!newComment.trim()) return; setSending(true)
    try { await api.post(`/bugs/${bug.id}/comments`, { content: newComment.trim() }); setNewComment(''); load() }
    catch { setErr('Failed to send') } finally { setSending(false) }
  }
  const edit = async (id: number) => {
    try { await api.patch(`/bugs/comments/${id}`, { content: editContent }); setEditingId(null); load() }
    catch (e: any) { setErr(e?.response?.data?.message || 'Edit failed') }
  }
  const del = async (id: number) => {
    if (!confirm('Delete this comment?')) return
    try { await api.delete(`/bugs/comments/${id}`); load() }
    catch (e: any) { setErr(e?.response?.data?.message || 'Delete failed') }
  }
  const withinWindow = (d: string) => (Date.now() - new Date(d).getTime()) / 60000 < 5

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
      <div className="bg-white border-l border-gray-100 w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div><p className="text-xs font-mono text-gray-400">{bug.bugId}</p><h3 className="text-sm font-semibold text-gray-800 truncate max-w-xs">{bug.title}</h3></div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0 bg-gray-50">
          {err && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11}/>{err}</p>}
          {loading
            ? <div className="flex justify-center py-10"><RefreshCw size={20} className="animate-spin text-emerald-500"/></div>
            : comments.length === 0
              ? <div className="text-center py-12 text-gray-400"><MessageSquare size={28} className="mx-auto mb-2"/><p className="text-sm">No comments yet</p></div>
              : comments.map(c => {
                  const isOwn = c.user.id === currentUserId; const canEdit = isOwn && withinWindow(c.createdAt)
                  return (
                    <div key={c.id} className={`flex flex-col gap-1 ${isOwn ? 'items-end' : 'items-start'}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${isOwn ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-semibold ${isOwn ? 'text-emerald-100' : 'text-gray-500'}`}>{c.user.email}</span>
                          <span className={`text-[10px] ${isOwn ? 'text-emerald-200' : 'text-gray-400'}`}>{fmt(c.createdAt)}</span>
                        </div>
                        {editingId === c.id
                          ? <div className="space-y-2">
                              <textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={2}
                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 focus:outline-none focus:border-emerald-400 resize-none"/>
                              <div className="flex gap-2">
                                <button onClick={() => edit(c.id)} className="text-xs text-emerald-600 font-semibold">Save</button>
                                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                              </div>
                            </div>
                          : <p className="leading-relaxed">{c.content}</p>
                        }
                      </div>
                      {canEdit && editingId !== c.id && (
                        <div className="flex gap-2 px-1">
                          <button onClick={() => { setEditingId(c.id); setEditContent(c.content) }} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"><Pencil size={10}/>Edit</button>
                          <button onClick={() => del(c.id)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500"><Trash2 size={10}/>Delete</button>
                        </div>
                      )}
                    </div>
                  )
                })
          }
        </div>
        <div className="px-5 py-4 border-t border-gray-100 shrink-0 bg-white">
          <div className="flex gap-2">
            <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Add a comment… (Enter to send)" rows={2}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-emerald-400 resize-none"/>
            <button onClick={send} disabled={sending || !newComment.trim()}
              className="self-end p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition">
              {sending ? <RefreshCw size={15} className="animate-spin"/> : <Send size={15}/>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bug Detail Drawer ────────────────────────────────────────────────────────

function BugDetailDrawer({ bug, onClose }: { bug: BugItem; onClose: () => void }) {
  const sm = STATUS_META[bug.status]
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20 backdrop-blur-sm">
      <div className="bg-white border-l border-gray-100 w-full max-w-lg h-full overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
          <div><p className="text-xs font-mono text-gray-400 mb-1">{bug.bugId}</p><h2 className="text-lg font-bold text-gray-800">{bug.title}</h2></div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg mt-1"><X size={18}/></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sm?.color} ${sm?.bg}`}>{sm?.label ?? bug.status}</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SEV_CLS[bug.severity] || ''}`}>{bug.severity}</span>
            <span className={`text-xs font-semibold ${PRI_CLS[bug.priority] || ''}`}>{bug.priority.replace('_',' ')}</span>
            <span className={`text-xs flex items-center gap-1 ${ageColor(bug.ageInDays)}`}><Clock size={11}/>{bug.ageInDays}d old</span>
          </div>

          {/* Waiting on tester notice inside drawer */}
          {WAITING_ON_TESTER[bug.status] && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-xs">
              <Info size={13} className="shrink-0" /> {WAITING_ON_TESTER[bug.status]}
            </div>
          )}

          <section>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-medium">Description</p>
            <p className="text-sm text-gray-600 leading-relaxed">{bug.description}</p>
          </section>
          {bug.stepsToReproduce && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-medium">Steps to Reproduce</p>
              <pre className="text-gray-500 whitespace-pre-wrap bg-gray-50 rounded-xl px-4 py-3 font-mono text-xs border border-gray-100">{bug.stepsToReproduce}</pre>
            </section>
          )}
          {bug.expectedBehavior && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1 font-medium">Expected</p>
              <p className="text-sm text-gray-600">{bug.expectedBehavior}</p>
            </section>
          )}
          {bug.actualBehavior && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1 font-medium">Actual</p>
              <p className="text-sm text-red-500">{bug.actualBehavior}</p>
            </section>
          )}
          {bug.environment && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1 font-medium">Environment</p>
              <p className="text-sm text-gray-500">{bug.environment}</p>
            </section>
          )}
          {bug.fixNotes && (
            <section className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-emerald-600 mb-2 font-medium flex items-center gap-1.5"><CheckCheck size={11}/>Fix Notes</p>
              <p className="text-sm text-emerald-700">{bug.fixNotes}</p>
              {bug.commitHash && (
                <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
                  <GitCommit size={11}/>{bug.commitHash}
                  {bug.branchName && <span className="ml-1">on {bug.branchName}</span>}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssignedBugs() {
  const [bugs, setBugs] = useState<BugItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [sort, setSort] = useState('')
  const [commentBug, setCommentBug] = useState<BugItem | null>(null)
  const [detailBug, setDetailBug] = useState<BugItem | null>(null)
  const [fixModal, setFixModal] = useState<number | null>(null)
  const [transitioning, setTransitioning] = useState<number | null>(null)
  const currentUserId = parseInt(localStorage.getItem('userId') ?? '0')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const params: Record<string, string> = {}
      if (statusFilter)   params.status   = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      if (sort)           params.sort     = sort
      const { data } = await api.get('/bugs/my/assigned', { params })
      setBugs(Array.isArray(data) ? data : data.bugs ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to fetch assigned bugs')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter, priorityFilter, sort])

  const transition = async (bugId: number, toStatus: string, needsFixNotes: boolean) => {
    if (needsFixNotes) { setFixModal(bugId); return }
    setTransitioning(bugId)
    try { await api.patch(`/bugs/${bugId}/status`, { status: toStatus }); load() }
    catch (e: any) { alert(e?.response?.data?.message || 'Status update failed') }
    finally { setTransitioning(null) }
  }

  const filtered = bugs.filter(b =>
    !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.bugId.toLowerCase().includes(search.toLowerCase())
  )
  const openCount  = bugs.filter(b => ['OPEN','IN_PROGRESS','REOPENED'].includes(b.status)).length
  const p1Count    = bugs.filter(b => b.priority === 'P1_URGENT').length
  const fixedCount = bugs.filter(b => b.status === 'FIXED').length

  const selCls = 'bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-emerald-400 transition shadow-sm'

  return (
    <div className="p-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 bg-white rounded-2xl border border-amber-100 shadow-sm">
          <Bug size={22} className="text-amber-500"/>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Assigned Bugs</h1>
          <p className="text-sm text-gray-400">{bugs.length} bug{bugs.length !== 1 ? 's' : ''} assigned to you</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Active',    value: openCount,  numColor: 'text-amber-500',   labelColor: 'text-amber-600',   border: 'border-amber-100' },
          { label: 'P1 Urgent', value: p1Count,    numColor: 'text-red-500',     labelColor: 'text-red-600',     border: 'border-red-100' },
          { label: 'Fixed',     value: fixedCount, numColor: 'text-emerald-500', labelColor: 'text-emerald-600', border: 'border-emerald-100' },
        ].map(s => (
          <div key={s.label} className={`bg-white rounded-2xl border ${s.border} px-6 py-5 shadow-sm`}>
            <p className={`text-3xl font-black ${s.numColor}`}>{s.value}</p>
            <p className={`text-xs mt-1 font-semibold ${s.labelColor}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or ID…"
            className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition shadow-sm"/>
        </div>
        <div className="flex items-center gap-2">
          <ListFilter size={13} className="text-gray-400"/>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selCls}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className={selCls}>
            <option value="">All Priorities</option>
            <option value="P1_URGENT">P1 Urgent</option>
            <option value="P2_HIGH">P2 High</option>
            <option value="P3_MEDIUM">P3 Medium</option>
            <option value="P4_LOW">P4 Low</option>
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} className={selCls}>
            <option value="">Sort: Default</option>
            <option value="priority">Priority</option>
            <option value="createdAt">Newest</option>
          </select>
        </div>
        <button onClick={load} disabled={loading}
          className="p-2.5 bg-white border border-gray-200 hover:border-emerald-300 text-gray-400 hover:text-emerald-600 rounded-xl transition shadow-sm disabled:opacity-40">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 text-red-600 text-sm">
          <AlertCircle size={15}/> {error}
          <button onClick={load} className="ml-auto text-xs flex items-center gap-1 font-semibold"><RefreshCw size={12}/>Retry</button>
        </div>
      )}

      {/* Bug List */}
      {loading ? (
        <div className="flex justify-center py-24"><RefreshCw size={28} className="animate-spin text-emerald-500"/></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex p-5 bg-white rounded-2xl mb-4 border border-gray-100 shadow-sm">
            <Bug size={40} className="text-gray-300"/>
          </div>
          <p className="text-gray-400 text-sm">
            {search || statusFilter || priorityFilter ? 'No bugs match your filters' : 'No bugs assigned to you 🎉'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(bug => {
            const sm = STATUS_META[bug.status]
            const actions = DEV_TRANSITIONS[bug.status] ?? []
            const waitingMsg = WAITING_ON_TESTER[bug.status]
            const isWorking = transitioning === bug.id

            return (
              <div key={bug.id}
                className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-emerald-200 hover:shadow-md transition shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-mono text-gray-400">{bug.bugId}</span>
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${sm?.color} ${sm?.bg}`}>{sm?.label ?? bug.status}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEV_CLS[bug.severity] || ''}`}>{bug.severity}</span>
                      <span className={`text-[10px] ${PRI_CLS[bug.priority] || ''}`}>{bug.priority.replace('_',' ')}</span>
                      <span className={`text-[10px] flex items-center gap-1 ml-auto ${ageColor(bug.ageInDays)}`}>
                        <Clock size={10}/>{bug.ageInDays}d old
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-800 truncate">{bug.title}</h3>

                    {/* Waiting on tester hint */}
                    {waitingMsg && (
                      <p className="text-[11px] text-blue-500 mt-1.5 flex items-center gap-1">
                        <Info size={11} className="shrink-0"/> {waitingMsg}
                      </p>
                    )}

                    {bug.fixNotes && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1.5 truncate">
                        <CheckCheck size={10}/>{bug.fixNotes}
                        {bug.commitHash && <span className="text-gray-400 font-mono ml-1">{bug.commitHash.slice(0,7)}</span>}
                      </p>
                    )}
                    {bug.environment && <p className="text-xs text-gray-400 mt-0.5">{bug.environment}</p>}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                    <button onClick={() => setDetailBug(bug)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition" title="View details">
                      <ChevronDown size={14}/>
                    </button>
                    <button onClick={() => setCommentBug(bug)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Comments">
                      <MessageSquare size={14}/>
                    </button>
                    {actions.map(({ toStatus, label, cls, fixNotes: fn }) => (
                      <button key={toStatus} onClick={() => transition(bug.id, toStatus, fn)} disabled={isWorking}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-40 shadow-sm ${cls}`}>
                        {isWorking && <RefreshCw size={11} className="animate-spin"/>}{label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {commentBug  && <CommentPanel bug={commentBug} currentUserId={currentUserId} onClose={() => setCommentBug(null)}/>}
      {detailBug   && <BugDetailDrawer bug={detailBug} onClose={() => setDetailBug(null)}/>}
      {fixModal !== null && <FixNotesModal bugId={fixModal} onClose={() => setFixModal(null)} onDone={load}/>}
    </div>
  )
}