import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { Bug, AlertCircle, ChevronDown, ArrowLeft, Send } from 'lucide-react'

const SEVERITIES = ['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL']
const PRIORITIES = ['P1_URGENT', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW']

const SEVERITY_HINT: Record<string, string> = {
  BLOCKER:  'Blocks all testing — must fix immediately',
  CRITICAL: 'Major functionality broken',
  MAJOR:    'Significant impact on functionality',
  MINOR:    'Minor impact, workaround exists',
  TRIVIAL:  'Cosmetic issue, low impact',
}
const PRIORITY_HINT: Record<string, string> = {
  P1_URGENT: 'Fix within 24 hours',
  P2_HIGH:   'Fix within this sprint',
  P3_MEDIUM: 'Fix in upcoming sprint',
  P4_LOW:    'Fix when time permits',
}
const SEVERITY_COLORS: Record<string, string> = {
  BLOCKER: 'text-red-400', CRITICAL: 'text-orange-400',
  MAJOR: 'text-yellow-400', MINOR: 'text-blue-400', TRIVIAL: 'text-gray-400',
}
const PRIORITY_COLORS: Record<string, string> = {
  P1_URGENT: 'text-red-400', P2_HIGH: 'text-orange-400',
  P3_MEDIUM: 'text-yellow-400', P4_LOW: 'text-gray-400',
}

interface Developer { id: number; name: string; email: string }

const inputCls    = 'w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition'
const textareaCls = `${inputCls} resize-none`
const selectCls   = `${inputCls} appearance-none pr-8`

export default function CreateBug() {
  const navigate        = useNavigate()
  const [searchParams]  = useSearchParams()

  const testCaseIdParam  = searchParams.get('testCaseId') ?? ''

  // ✅ projectId: URL param → localStorage fallback
  const projectId =
    searchParams.get('projectId') ||
    localStorage.getItem('lastProjectId') ||
    ''

  const [developers, setDevelopers] = useState<Developer[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState('')

  const [form, setForm] = useState({
    title:            '',
    description:      '',
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior:   '',
    severity:         'MAJOR',
    priority:         'P3_MEDIUM',
    environment:      '',
    affectedVersion:  '',
    assignedToId:     '',
    testCaseId:       testCaseIdParam,
    // executionId intentionally omitted — not in Bug schema
  })

  useEffect(() => {
    api.get('/users')
      .then(({ data }) => {
        const list = data.users ?? data ?? []
        setDevelopers(list.filter((u: any) => u.role === 'DEVELOPER'))
      })
      .catch(() => {})
  }, [])

  const set = (field: string, value: string) =>
    setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!projectId) {
      setError('No project selected. Open this page from a project.')
      return
    }

    setSubmitting(true)
    try {
      const payload: any = {
        projectId:        parseInt(projectId),   // ✅ required
        title:            form.title.trim(),
        description:      form.description.trim(),
        stepsToReproduce: form.stepsToReproduce.trim(),
        expectedBehavior: form.expectedBehavior.trim(),
        actualBehavior:   form.actualBehavior.trim(),
        severity:         form.severity,
        priority:         form.priority,
      }

      if (form.environment.trim())     payload.environment     = form.environment.trim()
      if (form.affectedVersion.trim()) payload.affectedVersion = form.affectedVersion.trim()
      if (form.assignedToId)           payload.assignedToId    = parseInt(form.assignedToId)
      if (form.testCaseId)             payload.testCaseId      = parseInt(form.testCaseId)
      // ✅ executionId NOT sent — not a Bug model field

      const { data } = await api.post('/bugs', payload)
      navigate(`/bugs?projectId=${projectId}`, { state: { created: data.id } })
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.errors?.[0]?.message ||
        'Failed to create bug report'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-800 rounded-lg transition text-gray-400">
            <ArrowLeft size={18} />
          </button>
          <Bug size={24} className="text-red-400" />
          <div>
            <h1 className="text-xl font-bold text-white">Create Bug Report</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {projectId
                ? `Project #${projectId}`
                : <span className="text-yellow-400">⚠ No project context</span>}
              {testCaseIdParam && ` · Test Case #${testCaseIdParam}`}
            </p>
          </div>
        </div>

        {!projectId && (
          <div className="flex items-center gap-2 p-4 bg-yellow-900/30 border border-yellow-800 rounded-xl mb-6 text-yellow-300 text-sm">
            <AlertCircle size={15} className="shrink-0" />
            No project selected — navigate here from a project page.
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-900/30 border border-red-800 rounded-xl mb-6 text-red-300 text-sm">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Bug Details */}
          <div className="bg-gray-900 rounded-xl p-6 space-y-5 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Bug Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="e.g. Login fails with valid credentials on Chrome"
                required className={inputCls} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Detailed description of the bug..." required rows={3} className={textareaCls} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">
                Steps to Reproduce <span className="text-red-400">*</span>
              </label>
              <textarea value={form.stepsToReproduce} onChange={e => set('stepsToReproduce', e.target.value)}
                placeholder={"1. Go to /login\n2. Enter valid email\n3. Click Sign In\n4. Observe error"}
                required rows={4} className={`${textareaCls} font-mono`} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Expected Behavior <span className="text-red-400">*</span>
                </label>
                <textarea value={form.expectedBehavior} onChange={e => set('expectedBehavior', e.target.value)}
                  placeholder="What should happen..." required rows={3} className={textareaCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Actual Behavior <span className="text-red-400">*</span>
                </label>
                <textarea value={form.actualBehavior} onChange={e => set('actualBehavior', e.target.value)}
                  placeholder="What actually happens..." required rows={3} className={textareaCls} />
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="bg-gray-900 rounded-xl p-6 space-y-5 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Classification</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Severity <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select value={form.severity} onChange={e => set('severity', e.target.value)} className={selectCls}>
                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <p className={`text-xs mt-1 ${SEVERITY_COLORS[form.severity]}`}>{SEVERITY_HINT[form.severity]}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Priority <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <select value={form.priority} onChange={e => set('priority', e.target.value)} className={selectCls}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <p className={`text-xs mt-1 ${PRIORITY_COLORS[form.priority]}`}>{PRIORITY_HINT[form.priority]}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Assign To Developer</label>
              <div className="relative">
                <select value={form.assignedToId} onChange={e => set('assignedToId', e.target.value)} className={selectCls}>
                  <option value="">Unassigned</option>
                  {developers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.email})</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {developers.length === 0 && (
                <p className="text-xs text-gray-600 mt-1">No developers found</p>
              )}
            </div>
          </div>

          {/* Environment & Links */}
          <div className="bg-gray-900 rounded-xl p-6 space-y-5 border border-gray-800">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Environment & Links</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Environment</label>
                <input value={form.environment} onChange={e => set('environment', e.target.value)}
                  placeholder="Chrome 120, Windows 11, Staging" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Affected Version</label>
                <input value={form.affectedVersion} onChange={e => set('affectedVersion', e.target.value)}
                  placeholder="v2.4.1" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Linked Test Case ID</label>
              <input value={form.testCaseId} onChange={e => set('testCaseId', e.target.value)}
                placeholder="e.g. 42" readOnly={!!testCaseIdParam}
                className={`${inputCls} ${testCaseIdParam ? 'opacity-60 cursor-not-allowed' : ''}`} />
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pb-8">
            <button type="button" onClick={() => navigate(-1)}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition">
              Cancel
            </button>
            <button type="submit" disabled={submitting || !projectId}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition">
              <Send size={15} />
              {submitting ? 'Creating...' : 'Create Bug Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}