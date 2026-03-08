import { useEffect, useState } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import {
  Bug, Plus, RefreshCw, AlertCircle, CheckCircle2,
  Search, MessageSquare, X, Send, Pencil, Trash2,
  User, GitCommit, CheckCheck, Eye
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BugUser { id: number; email: string }

interface Comment {
  id: number; content: string; createdAt: string
  user: { id: number; email: string; role: string }
}

interface BugItem {
  id: number; bugId: string; title: string
  description?: string; stepsToReproduce?: string
  priority: string; severity: string; status: string
  environment?: string; affectedVersion?: string
  fixNotes?: string; commitHash?: string; branchName?: string
  createdAt: string
  assignedTo?: BugUser | null
  createdBy?: BugUser | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  NEW:         { label: 'New',         color: 'text-gray-600',    bg: 'bg-gray-100 border-gray-300' },
  OPEN:        { label: 'Open',        color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200' },
  FIXED:       { label: 'Fixed',       color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  VERIFIED:    { label: 'Verified',    color: 'text-teal-700',    bg: 'bg-teal-50 border-teal-200' },
  CLOSED:      { label: 'Closed',      color: 'text-gray-500',    bg: 'bg-gray-50 border-gray-200' },
  REOPENED:    { label: 'Reopened',    color: 'text-red-700',     bg: 'bg-red-50 border-red-200' },
  WONT_FIX:    { label: "Won't Fix",   color: 'text-gray-500',    bg: 'bg-gray-100 border-gray-300' },
  DUPLICATE:   { label: 'Duplicate',   color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200' },
}

const SEVERITY_COLORS: Record<string, string> = {
  BLOCKER:  'text-red-700 bg-red-50 border border-red-200',
  CRITICAL: 'text-orange-700 bg-orange-50 border border-orange-200',
  MAJOR:    'text-amber-700 bg-amber-50 border border-amber-200',
  MINOR:    'text-blue-700 bg-blue-50 border border-blue-200',
  TRIVIAL:  'text-gray-500 bg-gray-100 border border-gray-200',
}

const PRIORITY_COLORS: Record<string, string> = {
  P1_URGENT: 'text-red-600 font-bold',
  P2_HIGH:   'text-orange-600 font-semibold',
  P3_MEDIUM: 'text-amber-600',
  P4_LOW:    'text-gray-400',
}

const TESTER_TRANSITIONS: Record<string, string[]> = {
  NEW:      ['OPEN', 'WONT_FIX', 'DUPLICATE'],
  FIXED:    ['VERIFIED', 'REOPENED'],
  VERIFIED: ['CLOSED'],
}

const TRANSITION_META: Record<string, { label: string; color: string }> = {
  OPEN:      { label: 'Accept',    color: 'bg-blue-600 hover:bg-blue-700 text-white' },
  WONT_FIX:  { label: "Won't Fix", color: 'bg-gray-400 hover:bg-gray-500 text-white' },
  DUPLICATE: { label: 'Duplicate', color: 'bg-purple-600 hover:bg-purple-700 text-white' },
  VERIFIED:  { label: 'Verify ✓',  color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
  REOPENED:  { label: 'Reopen',    color: 'bg-red-500 hover:bg-red-600 text-white' },
  CLOSED:    { label: 'Close',     color: 'bg-gray-500 hover:bg-gray-600 text-white' },
}

const DEV_TRANSITIONS: Record<string, { toStatus: string; label: string; color: string }[]> = {
  OPEN:        [{ toStatus: 'IN_PROGRESS', label: 'Start Work',  color: 'bg-amber-500 hover:bg-amber-600 text-white' }],
  IN_PROGRESS: [{ toStatus: 'FIXED',      label: 'Mark Fixed',  color: 'bg-emerald-600 hover:bg-emerald-700 text-white' }],
  REOPENED:    [{ toStatus: 'IN_PROGRESS', label: 'Start Again', color: 'bg-amber-500 hover:bg-amber-600 text-white' }],
}

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

// ─── Bug Detail Drawer ────────────────────────────────────────────────────────

function BugDetailDrawer({ bug, onClose }: { bug: BugItem; onClose: () => void }) {
  const sm = STATUS_META[bug.status]
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm">
      <div className="bg-white border-l border-gray-200 w-full max-w-lg h-full overflow-y-auto shadow-2xl">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <p className="text-xs font-mono text-gray-400 mb-1">{bug.bugId}</p>
            <h2 className="text-lg font-bold text-gray-900">{bug.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg mt-1">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sm?.color} ${sm?.bg}`}>
              {sm?.label ?? bug.status}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SEVERITY_COLORS[bug.severity] || ''}`}>
              {bug.severity}
            </span>
            <span className={`text-xs font-semibold ${PRIORITY_COLORS[bug.priority] || ''}`}>
              {bug.priority.replace('_', ' ')}
            </span>
          </div>
          {bug.description && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-semibold">Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{bug.description}</p>
            </section>
          )}
          {bug.stepsToReproduce && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 font-semibold">Steps to Reproduce</p>
              <pre className="text-gray-600 whitespace-pre-wrap bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs">
                {bug.stepsToReproduce}
              </pre>
            </section>
          )}
          {bug.environment && (
            <section>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1 font-semibold">Environment</p>
              <p className="text-sm text-gray-600">{bug.environment}</p>
            </section>
          )}
          {bug.fixNotes && (
            <section className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-emerald-600 mb-2 font-semibold flex items-center gap-1.5">
                <CheckCheck size={11} /> Fix Notes
              </p>
              <p className="text-sm text-emerald-800">{bug.fixNotes}</p>
              {bug.commitHash && (
                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                  <GitCommit size={11} /> {bug.commitHash}
                  {bug.branchName && <span className="ml-1 text-gray-400">on {bug.branchName}</span>}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Comment Panel ────────────────────────────────────────────────────────────

function CommentPanel({ bug, currentUserId, onClose }: {
  bug: BugItem; currentUserId: number; onClose: () => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState('')
  const [error, setError] = useState('')

  const loadComments = async () => {
    try {
      const { data } = await api.get(`/bugs/${bug.id}/comments`)
      setComments(Array.isArray(data) ? data : data.comments ?? [])
    } catch { setError('Failed to load comments') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadComments() }, [bug.id])

  const sendComment = async () => {
    if (!newComment.trim()) return; setSending(true)
    try { await api.post(`/bugs/${bug.id}/comments`, { content: newComment.trim() }); setNewComment(''); loadComments() }
    catch { setError('Failed to send') } finally { setSending(false) }
  }

  const editComment = async (id: number) => {
    try { await api.patch(`/bugs/comments/${id}`, { content: editContent }); setEditingId(null); loadComments() }
    catch (e: any) { setError(e?.response?.data?.message || 'Edit failed') }
  }

  const deleteComment = async (id: number) => {
    if (!confirm('Delete this comment?')) return
    try { await api.delete(`/bugs/comments/${id}`); loadComments() }
    catch (e: any) { setError(e?.response?.data?.message || 'Delete failed') }
  }

  const withinWindow = (d: string) => (Date.now() - new Date(d).getTime()) / 60000 < 5

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm">
      <div className="bg-white border-l border-gray-200 w-full max-w-md h-full flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs text-gray-400 font-mono">{bug.bugId}</p>
            <h3 className="text-sm font-semibold text-gray-900 truncate max-w-xs">{bug.title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0 bg-gray-50">
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
          {loading
            ? <div className="flex justify-center py-10"><RefreshCw size={20} className="animate-spin text-emerald-500" /></div>
            : comments.length === 0
              ? <div className="text-center py-12 text-gray-400"><MessageSquare size={28} className="mx-auto mb-2" /><p className="text-sm">No comments yet</p></div>
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
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 resize-none" />
                              <div className="flex gap-2">
                                <button onClick={() => editComment(c.id)} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold">Save</button>
                                <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                              </div>
                            </div>
                          : <p className="leading-relaxed">{c.content}</p>
                        }
                      </div>
                      {canEdit && editingId !== c.id && (
                        <div className="flex gap-2 px-1">
                          <button onClick={() => { setEditingId(c.id); setEditContent(c.content) }} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600"><Pencil size={10} />Edit</button>
                          <button onClick={() => deleteComment(c.id)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500"><Trash2 size={10} />Delete</button>
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
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
              placeholder="Add a comment… (Enter to send)" rows={2}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 resize-none" />
            <button onClick={sendComment} disabled={sending || !newComment.trim()}
              className="self-end p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl transition">
              {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Fix Notes Modal ──────────────────────────────────────────────────────────

function FixNotesModal({ bugId, toStatus, onClose, onDone }: {
  bugId: number; toStatus: string; onClose: () => void; onDone: () => void
}) {
  const [fixNotes, setFixNotes] = useState('')
  const [commitHash, setCommitHash] = useState('')
  const [branchName, setBranchName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!fixNotes.trim()) { setError('Fix notes are required'); return }
    setSaving(true); setError('')
    try { await api.patch(`/bugs/${bugId}/status`, { status: toStatus, fixNotes, commitHash, branchName }); onDone(); onClose() }
    catch (e: any) { setError(e?.response?.data?.message || 'Failed to update status') }
    finally { setSaving(false) }
  }

  const inp = 'w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><CheckCheck size={15} className="text-emerald-500" />Mark as Fixed</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Fix Notes <span className="text-red-400">*</span></label>
            <textarea value={fixNotes} onChange={e => setFixNotes(e.target.value)} placeholder="Describe the fix applied…" rows={3} className={`${inp} resize-none`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Commit Hash</label>
            <input value={commitHash} onChange={e => setCommitHash(e.target.value)} placeholder="abc123def" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Branch Name</label>
            <input value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="fix/login-validation" className={inp} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          <button onClick={submit} disabled={saving || !fixNotes.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <CheckCheck size={13} />} Submit Fix
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Bugs() {
  const navigate       = useNavigate()
  const location       = useLocation()
  const [searchParams] = useSearchParams()
  const { user }       = useAuth()

  const projectId  = searchParams.get('projectId') ?? localStorage.getItem('lastProjectId') ?? ''
  const isDev      = user?.role === 'DEVELOPER'

  const [bugs,          setBugs]          = useState<BugItem[]>([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [search,        setSearch]        = useState('')
  const [statusFilter,  setStatusFilter]  = useState('')
  const [commentBug,    setCommentBug]    = useState<BugItem | null>(null)
  const [detailBug,     setDetailBug]     = useState<BugItem | null>(null)
  const [fixModal,      setFixModal]      = useState<{ bugId: number; toStatus: string } | null>(null)
  const [transitioning, setTransitioning] = useState<number | null>(null)

  const currentUserId = parseInt(localStorage.getItem('userId') ?? '0')

  const [toast, setToast] = useState(location.state?.created ? 'Bug created successfully' : '')
  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(''), 3500); return () => clearTimeout(t) }
  }, [toast])

  const load = async () => {
    setLoading(true); setError('')
    try {
      let data: BugItem[]
      if (isDev) {
        const params: any = {}
        if (projectId) params.projectId = projectId
        const res = await api.get('/bugs', { params })
        data = Array.isArray(res.data) ? res.data : res.data.bugs ?? []
      } else {
        const params: any = {}
        if (projectId) params.projectId = projectId
        const res = await api.get('/bugs/my/reported', { params })
        data = Array.isArray(res.data) ? res.data : res.data.bugs ?? []
      }
      setBugs(data)
    } catch {
      setError('Failed to load bugs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [projectId, isDev])

  const transition = async (bugId: number, toStatus: string) => {
    if (toStatus === 'FIXED') { setFixModal({ bugId, toStatus }); return }
    setTransitioning(bugId)
    try { await api.patch(`/bugs/${bugId}/status`, { status: toStatus }); load() }
    catch (e: any) { alert(e?.response?.data?.message || 'Status update failed') }
    finally { setTransitioning(null) }
  }

  const filtered = bugs.filter(b => {
    const matchSearch = !search ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.bugId.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || b.status === statusFilter
    return matchSearch && matchStatus
  })

  const newBugUrl = `/bugs/new${projectId ? `?projectId=${projectId}` : ''}`

  const pageTitle    = isDev ? 'All Project Bugs'   : 'My Reported Bugs'
  const pageSubtitle = isDev ? 'All bugs in project' : 'Bugs you reported'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* Toast */}
        {toast && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm rounded-xl shadow-lg">
            <CheckCircle2 size={15} /> {toast}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isDev ? 'bg-amber-100' : 'bg-red-100'}`}>
              <Bug size={22} className={isDev ? 'text-amber-600' : 'text-red-500'} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-500">
                {bugs.length} total
                {projectId && <span className="ml-2 text-xs text-gray-400">· Project #{projectId}</span>}
                {isDev && <span className="ml-2 text-xs text-amber-600 font-medium">· Developer view</span>}
              </p>
            </div>
          </div>

          {!isDev && (
            <button onClick={() => navigate(newBugUrl)}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition shadow-sm">
              <Plus size={16} /> Report Bug
            </button>
          )}
        </div>

        {/* Developer banner */}
        {isDev && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
            <p className="text-sm text-amber-800">
              Viewing all project bugs. To see <strong>your assigned bugs</strong> and take action, use My Assigned Bugs.
            </p>
            <button onClick={() => navigate('/assigned-bugs')}
              className="shrink-0 ml-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-xl transition shadow-sm">
              My Assigned Bugs →
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bugs…"
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition shadow-sm" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-gray-400 shadow-sm">
            <option value="">All Statuses</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={load} disabled={loading}
            className="p-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-700 rounded-xl transition disabled:opacity-40 shadow-sm">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 text-red-600 text-sm">
            <AlertCircle size={15} /> {error}
            <button onClick={load} className="ml-auto text-xs flex items-center gap-1 font-semibold"><RefreshCw size={12} />Retry</button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <RefreshCw size={28} className={`animate-spin ${isDev ? 'text-amber-500' : 'text-red-400'}`} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="inline-flex p-5 bg-white rounded-2xl mb-4 border border-gray-200 shadow-sm">
              <Bug size={40} className="text-gray-300" />
            </div>
            <p className="text-gray-400 text-sm">
              {search || statusFilter ? 'No bugs match your filters' : pageSubtitle.replace('bugs', 'bugs yet')}
            </p>
            {!isDev && !search && !statusFilter && (
              <button onClick={() => navigate(newBugUrl)}
                className="mt-4 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition shadow-sm">
                Report your first bug
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] text-gray-400 uppercase tracking-wider bg-gray-50">
                  <th className="text-left px-5 py-3 font-semibold">Bug</th>
                  <th className="text-left px-4 py-3 font-semibold">Severity</th>
                  <th className="text-left px-4 py-3 font-semibold">Priority</th>
                  <th className="text-left px-4 py-3 font-semibold">Status</th>
                  <th className="text-left px-4 py-3 font-semibold">{isDev ? 'Reporter' : 'Assigned To'}</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-right px-5 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(bug => {
                  const sm        = STATUS_META[bug.status]
                  const isWorking = transitioning === bug.id

                  const testerActions = (TESTER_TRANSITIONS[bug.status] ?? []).map(s => ({
                    toStatus: s, ...TRANSITION_META[s]
                  })).filter(a => a.label)

                  const devActions = DEV_TRANSITIONS[bug.status] ?? []

                  return (
                    <tr key={bug.id} className="hover:bg-gray-50 transition">
                      <td className="px-5 py-4 max-w-xs">
                        <p className="text-[10px] font-mono text-gray-400 mb-0.5">{bug.bugId}</p>
                        <p className="text-sm font-semibold text-gray-800 truncate">{bug.title}</p>
                        {bug.fixNotes && (
                          <p className="text-[10px] text-emerald-600 mt-0.5 truncate flex items-center gap-1">
                            <GitCommit size={9} /> {bug.fixNotes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${SEVERITY_COLORS[bug.severity] || ''}`}>
                          {bug.severity}
                        </span>
                      </td>
                      <td className={`px-4 py-4 text-xs ${PRIORITY_COLORS[bug.priority] || 'text-gray-400'}`}>
                        {bug.priority.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full border font-medium ${sm?.color} ${sm?.bg}`}>
                          {sm?.label ?? bug.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-500">
                        {isDev
                          ? bug.createdBy
                            ? <span className="flex items-center gap-1"><User size={11} />{bug.createdBy.email}</span>
                            : <span className="text-gray-300">—</span>
                          : bug.assignedTo
                            ? <span className="flex items-center gap-1"><User size={11} />{bug.assignedTo.email}</span>
                            : <span className="text-gray-300">Unassigned</span>
                        }
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-400">{fmt(bug.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button onClick={() => setDetailBug(bug)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                            title="View details">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => setCommentBug(bug)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Comments">
                            <MessageSquare size={14} />
                          </button>

                          {!isDev && testerActions.map(({ toStatus, label, color }) => (
                            <button key={toStatus} onClick={() => transition(bug.id, toStatus)} disabled={isWorking}
                              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-40 shadow-sm ${color}`}>
                              {isWorking && <RefreshCw size={11} className="animate-spin" />}
                              {label}
                            </button>
                          ))}

                          {isDev && devActions.map(({ toStatus, label, color }) => (
                            <button key={toStatus} onClick={() => transition(bug.id, toStatus)} disabled={isWorking}
                              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-40 shadow-sm ${color}`}>
                              {isWorking && <RefreshCw size={11} className="animate-spin" />}
                              {label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailBug   && <BugDetailDrawer bug={detailBug} onClose={() => setDetailBug(null)} />}
      {commentBug  && <CommentPanel bug={commentBug} currentUserId={currentUserId} onClose={() => setCommentBug(null)} />}
      {fixModal    && <FixNotesModal bugId={fixModal.bugId} toStatus={fixModal.toStatus} onClose={() => setFixModal(null)} onDone={load} />}
    </div>
  )
}