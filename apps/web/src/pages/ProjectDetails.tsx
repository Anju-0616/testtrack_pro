import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../lib/api'
import {
  ClipboardList, Bug, Play, Users,
  RefreshCw, AlertCircle, ArrowLeft,
  CheckCircle2, X, UserPlus
} from 'lucide-react'

const BUG_STATUS_COLOR: Record<string, string> = {
  NEW:         'text-blue-500',
  OPEN:        'text-amber-500',
  IN_PROGRESS: 'text-orange-500',
  FIXED:       'text-emerald-600',
  VERIFIED:    'text-teal-600',
  CLOSED:      'text-gray-400',
  REOPENED:    'text-red-500',
}

export default function ProjectDetail() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState<any>(null)
  const [stats,   setStats]   = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState<'overview' | 'members'>('overview')

  const [showAddMember, setShowAddMember] = useState(false)
  const [allUsers,      setAllUsers]      = useState<any[]>([])
  const [selectedUser,  setSelectedUser]  = useState('')
  const [memberRole,    setMemberRole]    = useState('MEMBER')
  const [addingMember,  setAddingMember]  = useState(false)
  const [memberError,   setMemberError]   = useState('')
  const [memberSuccess, setMemberSuccess] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try {
      const [{ data: proj }, { data: st }] = await Promise.all([
        api.get(`/projects/${id}`),
        api.get(`/projects/${id}/stats`)
      ])
      setProject(proj); setStats(st)
    } catch { setError('Failed to load project') }
    finally { setLoading(false) }
  }

  const loadUsers = async () => {
    try { const { data } = await api.get('/users'); setAllUsers(data) } catch {}
  }

  useEffect(() => { load() }, [id])

  const handleAddMember = async () => {
    if (!selectedUser) { setMemberError('Please select a user'); return }
    setAddingMember(true); setMemberError(''); setMemberSuccess('')
    try {
      await api.post(`/projects/${id}/members`, { userId: parseInt(selectedUser), role: memberRole })
      setMemberSuccess('Member added successfully!')
      setSelectedUser(''); setMemberRole('MEMBER'); setShowAddMember(false)
      load(); setTimeout(() => setMemberSuccess(''), 3000)
    } catch (err: any) {
      setMemberError(err?.response?.data?.message || 'Failed to add member')
    } finally { setAddingMember(false) }
  }

  const handleRemoveMember = async (userId: number) => {
    if (!confirm('Remove this member from the project?')) return
    try { await api.delete(`/projects/${id}/members/${userId}`); load() }
    catch (err: any) { alert(err?.response?.data?.message || 'Failed to remove member') }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw size={28} className="animate-spin text-emerald-500" />
    </div>
  )

  if (error || !project) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-500 mb-4">{error || 'Project not found'}</p>
        <button onClick={() => navigate('/projects')} className="text-emerald-600 hover:text-emerald-700">← Back to Projects</button>
      </div>
    </div>
  )

  const tcStats  = stats?.testCaseStats ?? []
  const bugStats = stats?.bugStats      ?? []
  const runStats = stats?.runStats      ?? []
  const totalTc   = tcStats.reduce((a: number, s: any)  => a + s._count, 0)
  const totalBugs = bugStats.reduce((a: number, s: any) => a + s._count, 0)
  const totalRuns = runStats.reduce((a: number, s: any) => a + s._count, 0)
  const existingIds    = new Set(project.members?.map((m: any) => m.userId))
  const availableUsers = allUsers.filter((u: any) => !existingIds.has(u.id))

  return (
    <div className="p-8">

      {/* Header */}
      <div className="mb-8">
        <button onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-emerald-600 mb-4 transition">
          <ArrowLeft size={15} /> All Projects
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xs font-mono text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                {project.key}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {project.myRole}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-gray-800">{project.name}</h1>
            {project.description && <p className="text-gray-400 mt-1">{project.description}</p>}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'New Test Case', icon: <ClipboardList size={16} />, cls: 'bg-emerald-500 hover:bg-emerald-600', onClick: () => navigate(`/test-cases/new?projectId=${id}`) },
          { label: 'New Bug',       icon: <Bug size={16} />,           cls: 'bg-red-500 hover:bg-red-600',         onClick: () => navigate(`/bugs/new?projectId=${id}`) },
          { label: 'New Test Run',  icon: <Play size={16} />,          cls: 'bg-blue-500 hover:bg-blue-600',       onClick: () => navigate(`/test-runs?projectId=${id}`) },
          { label: 'View Reports',  icon: <CheckCircle2 size={16} />,  cls: 'bg-gray-500 hover:bg-gray-600',       onClick: () => navigate(`/reports?projectId=${id}`) },
        ].map(a => (
          <button key={a.label} onClick={a.onClick}
            className={`flex items-center justify-center gap-2 px-4 py-3 ${a.cls} text-white text-sm font-medium rounded-xl transition shadow-sm`}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        {[
          { label: 'Test Cases', value: totalTc,   icon: <ClipboardList size={20} />, numColor: 'text-emerald-600', border: 'border-emerald-100', link: `/test-cases?projectId=${id}` },
          { label: 'Bugs',       value: totalBugs, icon: <Bug size={20} />,           numColor: 'text-red-500',     border: 'border-red-100',     link: `/bugs?projectId=${id}` },
          { label: 'Test Runs',  value: totalRuns, icon: <Play size={20} />,          numColor: 'text-blue-500',    border: 'border-blue-100',    link: `/test-runs?projectId=${id}` },
        ].map(s => (
          <div key={s.label} onClick={() => navigate(s.link)}
            className={`bg-white border ${s.border} hover:shadow-md rounded-2xl p-6 cursor-pointer transition shadow-sm`}>
            <div className={`${s.numColor} mb-3`}>{s.icon}</div>
            <p className={`text-3xl font-bold ${s.numColor}`}>{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white border border-gray-100 shadow-sm rounded-xl p-1 w-fit">
        {(['overview', 'members'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'members') loadUsers() }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
              tab === t ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>{t}</button>
        ))}
      </div>

      {/* Success toast */}
      {memberSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl shadow-lg">
          <CheckCircle2 size={15} /> {memberSuccess}
        </div>
      )}

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Bug size={15} className="text-red-400" /> Bug Status
            </h3>
            {bugStats.length === 0 ? (
              <p className="text-gray-400 text-sm">No bugs yet</p>
            ) : (
              <div className="space-y-2">
                {bugStats.map((s: any) => (
                  <div key={s.status} className="flex items-center justify-between">
                    <span className={`text-sm ${BUG_STATUS_COLOR[s.status] || 'text-gray-400'}`}>{s.status}</span>
                    <span className="text-sm font-semibold text-gray-800">{s._count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Users size={15} className="text-blue-400" /> Team ({project.members?.length ?? 0})
            </h3>
            <div className="space-y-3">
              {project.members?.map((m: any) => (
                <div key={m.userId} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {m.user.name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{m.user.name}</p>
                    <p className="text-xs text-gray-400">{m.user.role}</p>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{m.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Members Tab */}
      {tab === 'members' && (
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <Users size={15} className="text-blue-400" /> Members ({project.members?.length ?? 0})
            </h3>
            {project.myRole === 'OWNER' && (
              <button onClick={() => { setShowAddMember(v => !v); setMemberError('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition">
                <UserPlus size={13} /> Add Member
              </button>
            )}
          </div>

          {showAddMember && project.myRole === 'OWNER' && (
            <div className="px-6 py-4 bg-emerald-50/50 border-b border-gray-100">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-48">
                  <label className="block text-xs text-gray-500 mb-1.5">Select User</label>
                  <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-emerald-400">
                    <option value="">— Choose a user —</option>
                    {availableUsers.map((u: any) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email}) — {u.role}</option>
                    ))}
                  </select>
                </div>
                <div className="w-36">
                  <label className="block text-xs text-gray-500 mb-1.5">Role</label>
                  <select value={memberRole} onChange={e => setMemberRole(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-emerald-400">
                    <option value="MEMBER">MEMBER</option>
                    <option value="OWNER">OWNER</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddMember} disabled={addingMember}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition">
                    {addingMember ? <RefreshCw size={14} className="animate-spin" /> : 'Add'}
                  </button>
                  <button onClick={() => { setShowAddMember(false); setMemberError('') }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg transition">
                    <X size={14} />
                  </button>
                </div>
              </div>
              {memberError && <p className="text-xs text-red-500 mt-2 flex items-center gap-1"><AlertCircle size={11} /> {memberError}</p>}
              {availableUsers.length === 0 && <p className="text-xs text-gray-400 mt-2">All registered users are already members.</p>}
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {project.members?.map((m: any) => (
              <div key={m.userId} className="flex items-center gap-3 px-6 py-4">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0">
                  {m.user.name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{m.user.name}</p>
                  <p className="text-xs text-gray-400">{m.user.email} · {m.user.role}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-medium ${
                  m.role === 'OWNER' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-500'
                }`}>{m.role}</span>
                {project.myRole === 'OWNER' && m.role !== 'OWNER' && (
                  <button onClick={() => handleRemoveMember(m.userId)}
                    className="text-red-400 hover:text-red-500 text-xs px-2 py-1 hover:bg-red-50 rounded transition ml-2">
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}