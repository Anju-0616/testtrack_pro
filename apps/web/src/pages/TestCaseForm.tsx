import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import api from '../lib/api'

const PRIORITIES  = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const SEVERITIES  = ['TRIVIAL', 'MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER']
const TYPES       = ['FUNCTIONAL', 'REGRESSION', 'SMOKE', 'INTEGRATION', 'UAT', 'PERFORMANCE', 'SECURITY', 'USABILITY']
const MODULES     = ['Authentication', 'User Management', 'Test Cases', 'Bug Management', 'Reports', 'Notifications', 'Settings', 'Other']
const AUTO_STATUS = ['NOT_AUTOMATED', 'IN_PROGRESS', 'AUTOMATED', 'CANNOT_AUTOMATE']

interface Step {
  action:         string
  testData:       string
  expectedResult: string
  notes:          string
}

const emptyStep = (): Step => ({ action: '', testData: '', expectedResult: '', notes: '' })

const inputCls    = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition'
const textareaCls = `${inputCls} resize-none`
const selectCls   = `${inputCls}`

export default function TestCaseForm() {
  const { id }                    = useParams()
  const [searchParams]            = useSearchParams()
  const navigate                  = useNavigate()
  const isEdit                    = Boolean(id)

  const projectId = searchParams.get('projectId')

  const [loading,   setLoading]   = useState(false)
  const [fetching,  setFetching]  = useState(isEdit)
  const [error,     setError]     = useState('')
  const [tagInput,  setTagInput]  = useState('')

  const [form, setForm] = useState({
    title:                   '',
    module:                  'Authentication',
    description:             '',
    priority:                'MEDIUM',
    severity:                'MAJOR',
    type:                    'FUNCTIONAL',
    status:                  'DRAFT',
    tags:                    [] as string[],
    preconditions:           '',
    testDataRequirements:    '',
    environmentRequirements: '',
    postconditions:          '',
    cleanupSteps:            '',
    estimatedDuration:       '',
    automationStatus:        'NOT_AUTOMATED',
    automationScriptLink:    '',
    changeSummary:           ''
  })

  const [steps, setSteps] = useState<Step[]>([emptyStep()])

  useEffect(() => {
    if (!isEdit) return
    setFetching(true)
    api.get(`/test-cases/${id}`)
      .then(({ data }) => {
        setForm({
          title:                   data.title || '',
          module:                  data.module || 'Authentication',
          description:             data.description || '',
          priority:                data.priority || 'MEDIUM',
          severity:                data.severity || 'MAJOR',
          type:                    data.type || 'FUNCTIONAL',
          status:                  data.status || 'DRAFT',
          tags:                    data.tags || [],
          preconditions:           data.preconditions || '',
          testDataRequirements:    data.testDataRequirements || '',
          environmentRequirements: data.environmentRequirements || '',
          postconditions:          data.postconditions || '',
          cleanupSteps:            data.cleanupSteps || '',
          estimatedDuration:       data.estimatedDuration?.toString() || '',
          automationStatus:        data.automationStatus || 'NOT_AUTOMATED',
          automationScriptLink:    data.automationScriptLink || '',
          changeSummary:           ''
        })
        if (data.steps?.length > 0) {
          setSteps(data.steps.map((s: any) => ({
            action:         s.action,
            testData:       s.testData || '',
            expectedResult: s.expectedResult,
            notes:          s.notes || ''
          })))
        }
      })
      .catch(() => setError('Failed to load test case'))
      .finally(() => setFetching(false))
  }, [id])

  const setField = (field: string, value: any) =>
    setForm(f => ({ ...f, [field]: value }))

  const updateStep = (i: number, field: keyof Step, value: string) =>
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step))

  const addStep    = () => setSteps(s => [...s, emptyStep()])
  const removeStep = (i: number) => setSteps(s => s.filter((_, idx) => idx !== i))
  const moveStep   = (i: number, dir: -1 | 1) => {
    const arr  = [...steps]
    const swap = i + dir
    if (swap < 0 || swap >= arr.length) return
    ;[arr[i], arr[swap]] = [arr[swap], arr[i]]
    setSteps(arr)
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !form.tags.includes(t)) setField('tags', [...form.tags, t])
    setTagInput('')
  }
  const removeTag = (t: string) => setField('tags', form.tags.filter(x => x !== t))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.title.trim())
      return setError('Title is required')
    if (!isEdit && !projectId)
      return setError('No project selected — go back and open this form from a project page')
    if (steps.some(s => !s.action.trim() || !s.expectedResult.trim()))
      return setError('Each step needs an action and expected result')
    if (isEdit && !form.changeSummary.trim())
      return setError('Change summary is required when editing')

    setLoading(true)
    try {
      const payload = {
        ...form,
        ...(isEdit ? {} : { projectId }),
        estimatedDuration: form.estimatedDuration ? parseInt(form.estimatedDuration) : null,
        steps: steps.map(s => ({
          action:         s.action.trim(),
          testData:       s.testData.trim()       || null,
          expectedResult: s.expectedResult.trim(),
          notes:          s.notes.trim()          || null
        }))
      }

      if (isEdit) {
        await api.put(`/test-cases/${id}`, payload)
      } else {
        await api.post('/test-cases', payload)
      }

      navigate(projectId ? `/test-cases?projectId=${projectId}` : '/test-cases')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save test case')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-700 font-medium text-sm transition">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isEdit ? 'Edit Test Case' : 'Create Test Case'}
            </h1>
            {!isEdit && projectId && (
              <span className="text-xs text-emerald-600 font-medium">Project #{projectId}</span>
            )}
          </div>
        </div>

        {/* Warning if no projectId on create */}
        {!isEdit && !projectId && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
            ⚠️ No project selected. Please open this page from a project — e.g.{' '}
            <code className="bg-amber-100 px-1 rounded text-xs">
              /test-cases/new?projectId=1
            </code>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── Basic Info ─────────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-3">
              Basic Information
            </h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text" maxLength={200}
                value={form.title} onChange={e => setField('title', e.target.value)}
                placeholder="Brief descriptive title (max 200 chars)"
                className={inputCls}
              />
              <p className="text-xs text-gray-400 mt-1">{form.title.length}/200</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Module <span className="text-red-400">*</span>
                </label>
                <select value={form.module} onChange={e => setField('module', e.target.value)} className={selectCls}>
                  {MODULES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                <select value={form.type} onChange={e => setField('type', e.target.value)} className={selectCls}>
                  {TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Priority', field: 'priority', opts: PRIORITIES },
                { label: 'Severity', field: 'severity', opts: SEVERITIES },
                { label: 'Status',   field: 'status',   opts: ['DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'DEPRECATED', 'ARCHIVED'] }
              ].map(({ label, field, opts }) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <select value={(form as any)[field]} onChange={e => setField(field, e.target.value)} className={selectCls}>
                    {opts.map(o => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                rows={3} value={form.description} onChange={e => setField('description', e.target.value)}
                placeholder="Detailed description of what is being tested"
                className={textareaCls}
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {form.tags.map(tag => (
                  <span key={tag} className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-medium">
                    #{tag}
                    <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                  placeholder="Type tag and press Enter"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition"
                />
                <button type="button" onClick={addTag}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium transition">
                  Add
                </button>
              </div>
            </div>
          </section>

          {/* ── Pre/Post Conditions ────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-3">
              Conditions & Requirements
            </h2>

            {[
              { label: 'Pre-conditions',          field: 'preconditions',           ph: 'Conditions that must be true before execution' },
              { label: 'Test Data Requirements',   field: 'testDataRequirements',    ph: 'e.g. Valid email: test@example.com' },
              { label: 'Environment Requirements', field: 'environmentRequirements', ph: 'e.g. Chrome 120+, Windows 11' },
              { label: 'Post-conditions',          field: 'postconditions',          ph: 'Expected system state after test' },
              { label: 'Cleanup Steps',            field: 'cleanupSteps',            ph: 'Steps to reset system state' }
            ].map(({ label, field, ph }) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                <textarea
                  rows={2} value={(form as any)[field]} onChange={e => setField(field, e.target.value)}
                  placeholder={ph}
                  className={textareaCls}
                />
              </div>
            ))}
          </section>

          {/* ── Test Steps ────────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Test Steps</h2>
              <button type="button" onClick={addStep}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition shadow-sm">
                + Add Step
              </button>
            </div>

            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-emerald-600">Step {i + 1}</span>
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-2 py-1 bg-white border border-gray-200 rounded-lg transition">↑</button>
                      <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                        className="text-gray-400 hover:text-gray-700 disabled:opacity-30 text-xs px-2 py-1 bg-white border border-gray-200 rounded-lg transition">↓</button>
                      {steps.length > 1 && (
                        <button type="button" onClick={() => removeStep(i)}
                          className="text-red-400 hover:text-red-600 text-xs px-2 py-1 bg-white border border-red-200 rounded-lg transition">Remove</button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Action <span className="text-red-400">*</span></label>
                      <textarea rows={2} value={step.action} onChange={e => updateStep(i, 'action', e.target.value)}
                        placeholder="What the tester should do"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 resize-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Expected Result <span className="text-red-400">*</span></label>
                      <textarea rows={2} value={step.expectedResult} onChange={e => updateStep(i, 'expectedResult', e.target.value)}
                        placeholder="What should happen"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 resize-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Test Data</label>
                      <input type="text" value={step.testData} onChange={e => updateStep(i, 'testData', e.target.value)}
                        placeholder="e.g. Email: test@example.com"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label>
                      <input type="text" value={step.notes} onChange={e => updateStep(i, 'notes', e.target.value)}
                        placeholder="Additional observations"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 transition"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Metadata ──────────────────────────────────────────────── */}
          <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-3">
              Metadata
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Duration (min)</label>
                <input type="number" min={1} value={form.estimatedDuration}
                  onChange={e => setField('estimatedDuration', e.target.value)}
                  placeholder="e.g. 5" className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Automation Status</label>
                <select value={form.automationStatus} onChange={e => setField('automationStatus', e.target.value)} className={selectCls}>
                  {AUTO_STATUS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Automation Script Link</label>
                <input type="text" value={form.automationScriptLink}
                  onChange={e => setField('automationScriptLink', e.target.value)}
                  placeholder="github.com/..." className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* ── Change Summary (edit only) ────────────────────────────── */}
          {isEdit && (
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100 pb-3 mb-5">
                Change Summary
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  What did you change? <span className="text-red-400">*</span>
                </label>
                <textarea rows={2} value={form.changeSummary}
                  onChange={e => setField('changeSummary', e.target.value)}
                  placeholder="e.g. Updated step 3 expected result for clarity"
                  className={textareaCls}
                />
              </div>
            </section>
          )}

          {/* ── Actions ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-4 pb-8">
            <button type="submit" disabled={loading}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition">
              {loading ? 'Saving...' : isEdit ? 'Update Test Case' : 'Create Test Case'}
            </button>
            <button type="button" onClick={() => navigate(-1)}
              className="px-8 py-3 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium rounded-xl transition shadow-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}