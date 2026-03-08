import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'

type StepStatus = 'PENDING' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED'

interface Step {
  id:             number
  stepNumber:     number
  action:         string
  testData:       string | null
  expectedResult: string
  notes:          string | null
}

interface StepResult {
  stepId:       number
  status:       StepStatus
  actualResult: string
  notes:        string
}

interface Execution {
  id:         number
  status:     string
  testCase:   { id: number; title: string; module: string }
  stepResults: Array<{ stepId: number; status: StepStatus; actualResult: string; notes: string }>
}

const STATUS_CONFIG: Record<StepStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-gray-400',   bg: 'bg-gray-700' },
  PASS:    { label: 'Pass',    color: 'text-green-400',  bg: 'bg-green-900/40 border-green-700' },
  FAIL:    { label: 'Fail',    color: 'text-red-400',    bg: 'bg-red-900/40 border-red-700' },
  BLOCKED: { label: 'Blocked', color: 'text-yellow-400', bg: 'bg-yellow-900/40 border-yellow-700' },
  SKIPPED: { label: 'Skipped', color: 'text-blue-400',   bg: 'bg-blue-900/40 border-blue-700' },
}

export default function ExecutionInterface() {
  const { testCaseId } = useParams()
  const [searchParams]  = useSearchParams()
  const testRunId       = searchParams.get('testRunId')
  const navigate        = useNavigate()

  const [testCase,   setTestCase]   = useState<any>(null)
  const [execution,  setExecution]  = useState<Execution | null>(null)
  const [stepResults, setStepResults] = useState<Record<number, StepResult>>({})
  const [activeStep,  setActiveStep]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [saving,      setSaving]      = useState(false)
  const [completing,  setCompleting]  = useState(false)
  const [error,       setError]       = useState('')
  const [timer,       setTimer]       = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const timerRef = useRef<any>(null)

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [timerActive])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // ── Load test case ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!testCaseId) return
    api.get(`/test-cases/${testCaseId}`)
      .then(({ data }) => {
        setTestCase(data)
        // Pre-fill step results as PENDING
        const initial: Record<number, StepResult> = {}
        data.steps.forEach((s: Step) => {
          initial[s.id] = { stepId: s.id, status: 'PENDING', actualResult: '', notes: '' }
        })
        setStepResults(initial)
      })
      .catch(() => setError('Failed to load test case'))
      .finally(() => setLoading(false))
  }, [testCaseId])

  // ── Start execution on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!testCase) return
    api.post('/executions', {
      testCaseId: parseInt(testCaseId!),
      testRunId:  testRunId ? parseInt(testRunId) : undefined
    })
      .then(({ data }) => {
        setExecution(data)
        setTimerActive(true)
      })
      .catch(err => setError(err.response?.data?.message || 'Failed to start execution'))
  }, [testCase])

  // ── Mark step ─────────────────────────────────────────────────────────────
  const markStep = async (stepId: number, status: StepStatus) => {
    if (!execution) return
    setSaving(true)
    try {
      await api.put(`/executions/${execution.id}/steps/${stepId}`, {
        status,
        actualResult: stepResults[stepId]?.actualResult || null,
        notes:        stepResults[stepId]?.notes        || null
      })
      setStepResults(prev => ({ ...prev, [stepId]: { ...prev[stepId], status } }))

      // Auto-advance to next step if not last
      const steps = testCase?.steps || []
      const currentIdx = steps.findIndex((s: Step) => s.id === stepId)
      if (currentIdx < steps.length - 1 && status === 'PASS') {
        setActiveStep(currentIdx + 1)
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save step')
    } finally {
      setSaving(false)
    }
  }

  const saveActualResult = async (stepId: number) => {
    if (!execution) return
    const result = stepResults[stepId]
    if (!result || result.status === 'PENDING') return
    try {
      await api.put(`/executions/${execution.id}/steps/${stepId}`, {
        status:       result.status,
        actualResult: result.actualResult || null,
        notes:        result.notes        || null
      })
    } catch {}
  }

  // ── Complete execution ─────────────────────────────────────────────────────
  const completeExecution = async () => {
    if (!execution) return
    setTimerActive(false)
    setCompleting(true)
    try {
      await api.put(`/executions/${execution.id}/complete`, { timeSpent: Math.round(timer / 60) })
      navigate(`/test-cases/${testCaseId}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to complete execution')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !testCase) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={() => navigate(-1)} className="text-emerald-400 hover:text-emerald-300">← Go back</button>
        </div>
      </div>
    )
  }

  const steps: Step[] = testCase?.steps || []
  const completed = steps.filter(s => stepResults[s.id]?.status !== 'PENDING').length
  const progress  = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0

  const statusCounts = { PASS: 0, FAIL: 0, BLOCKED: 0, SKIPPED: 0, PENDING: 0 }
  Object.values(stepResults).forEach(r => { statusCounts[r.status]++ })

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">← Back</button>
            <span className="text-gray-600">|</span>
            <span className="text-emerald-400 text-sm font-medium">Executing</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{testCase?.title}</h1>
          <p className="text-gray-400 text-sm mt-1">{testCase?.module} · {steps.length} steps</p>
        </div>

        {/* Timer */}
        <div className="flex items-center gap-4">
          <div className="bg-gray-800 rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-gray-400 mb-0.5">Elapsed</p>
            <p className="text-2xl font-mono font-bold text-white">{formatTime(timer)}</p>
            <button
              onClick={() => setTimerActive(t => !t)}
              className="text-xs text-emerald-400 hover:text-emerald-300 mt-1"
            >
              {timerActive ? '⏸ Pause' : '▶ Resume'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Progress Bar ───────────────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Progress</span>
          <span className="text-sm text-white font-medium">{completed}/{steps.length} steps ({progress}%)</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-4 mt-3">
          {Object.entries(statusCounts).map(([status, count]) => count > 0 && (
            <div key={status} className={`flex items-center gap-1.5 text-xs ${STATUS_CONFIG[status as StepStatus].color}`}>
              <span className="font-semibold">{count}</span> {status}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">

        {/* ── Step Navigator (left panel) ─────────────────────────────────── */}
        <div className="col-span-1 space-y-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Steps</h3>
          {steps.map((step, i) => {
            const result = stepResults[step.id]
            const cfg    = STATUS_CONFIG[result?.status || 'PENDING']
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(i)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${
                  i === activeStep
                    ? 'border-emerald-500 bg-emerald-900/20'
                    : `border-gray-700 hover:border-gray-500 ${result?.status !== 'PENDING' ? cfg.bg : 'bg-gray-800'}`
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Step {step.stepNumber}</span>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{step.action}</p>
              </button>
            )
          })}
        </div>

        {/* ── Step Detail (right panel) ───────────────────────────────────── */}
        <div className="col-span-2">
          {steps.length > 0 && steps[activeStep] && (() => {
            const step   = steps[activeStep]
            const result = stepResults[step.id]

            return (
              <div className={`bg-gray-800 border rounded-xl p-6 ${
                result?.status !== 'PENDING' ? `${STATUS_CONFIG[result.status].bg} border-opacity-50` : 'border-gray-700'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Step {step.stepNumber}</h3>
                  {result?.status !== 'PENDING' && (
                    <span className={`text-sm font-semibold px-3 py-1 rounded-full ${STATUS_CONFIG[result.status].color} bg-gray-700`}>
                      {STATUS_CONFIG[result.status].label}
                    </span>
                  )}
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Action</p>
                    <p className="text-white">{step.action}</p>
                  </div>
                  {step.testData && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Test Data</p>
                      <p className="text-emerald-300 font-mono text-sm bg-gray-700 px-3 py-2 rounded-lg">{step.testData}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Expected Result</p>
                    <p className="text-blue-300">{step.expectedResult}</p>
                  </div>
                  {step.notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                      <p className="text-gray-400 text-sm italic">{step.notes}</p>
                    </div>
                  )}
                </div>

                {/* Actual Result */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Actual Result</label>
                  <textarea
                    rows={3}
                    value={result?.actualResult || ''}
                    onChange={e => setStepResults(prev => ({
                      ...prev,
                      [step.id]: { ...prev[step.id], actualResult: e.target.value }
                    }))}
                    onBlur={() => saveActualResult(step.id)}
                    placeholder="What actually happened? (required if failing)"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Observations</label>
                  <input
                    type="text"
                    value={result?.notes || ''}
                    onChange={e => setStepResults(prev => ({
                      ...prev,
                      [step.id]: { ...prev[step.id], notes: e.target.value }
                    }))}
                    onBlur={() => saveActualResult(step.id)}
                    placeholder="Optional additional notes"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Mark Buttons */}
                <div className="flex items-center gap-3">
                  {(['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'] as StepStatus[]).map(status => {
                    const cfg    = STATUS_CONFIG[status]
                    const active = result?.status === status
                    return (
                      <button
                        key={status}
                        onClick={() => markStep(step.id, status)}
                        disabled={saving}
                        className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                          active
                            ? `${cfg.bg} ${cfg.color} border border-opacity-70`
                            : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white border border-transparent'
                        } disabled:opacity-50`}
                      >
                        {status === 'PASS' ? '✓ Pass' : status === 'FAIL' ? '✗ Fail' : status === 'BLOCKED' ? '⊘ Blocked' : '→ Skip'}
                      </button>
                    )
                  })}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setActiveStep(i => Math.max(0, i - 1))}
                    disabled={activeStep === 0}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 text-gray-300 rounded-lg text-sm"
                  >
                    ← Previous
                  </button>

                  {activeStep < steps.length - 1 ? (
                    <button
                      onClick={() => setActiveStep(i => i + 1)}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-sm"
                    >
                      Next Step →
                    </button>
                  ) : (
                    <button
                      onClick={completeExecution}
                      disabled={completing}
                      className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg text-sm"
                    >
                      {completing ? 'Completing...' : '✓ Complete Execution'}
                    </button>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>
    </div>
  )
}