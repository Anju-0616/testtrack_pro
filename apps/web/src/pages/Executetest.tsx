import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import {
  CheckCircle2, XCircle, MinusCircle, SkipForward, Clock,
  Play, ChevronLeft, ChevronRight, AlertCircle, RefreshCw,
  Pause, RotateCcw, ClipboardList, Flag, CheckCheck,
  CircleDot, AlignLeft, Loader2
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepStatus = 'PENDING' | 'PASS' | 'FAIL' | 'BLOCKED' | 'SKIPPED'
type ExecStatus = 'IN_PROGRESS' | 'PASS' | 'FAIL' | 'BLOCKED'

interface TestStep {
  id: number
  stepNumber: number
  action: string
  testData?: string
  expectedResult: string
  notes?: string
}

interface ExecutionStep {
  stepId: any
  id: number
  testCaseStepId: number
  stepStatus: StepStatus
  actualResult?: string
}

interface TestCase {
  id: number
  title: string
  module?: string
  priority: string
  projectId?: number
  preconditions?: string
  description?: string
  steps: TestStep[]
}

interface Execution {
  id: number
  status: ExecStatus
  startedAt: string
  completedAt?: string
  duration?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_OPTIONS: {
  status: StepStatus
  label: string
  color: string
  activeColor: string
  activeBg: string
  icon: React.ReactNode
}[] = [
  {
    status:      'PASS',
    label:       'Pass',
    color:       'text-gray-400 hover:text-emerald-300 border-gray-700 hover:border-emerald-700',
    activeColor: 'text-emerald-300',
    activeBg:    'bg-emerald-900/30 border-emerald-700',
    icon:        <CheckCircle2 size={16} />,
  },
  {
    status:      'FAIL',
    label:       'Fail',
    color:       'text-gray-400 hover:text-red-300 border-gray-700 hover:border-red-700',
    activeColor: 'text-red-300',
    activeBg:    'bg-red-900/30 border-red-700',
    icon:        <XCircle size={16} />,
  },
  {
    status:      'BLOCKED',
    label:       'Blocked',
    color:       'text-gray-400 hover:text-orange-300 border-gray-700 hover:border-orange-700',
    activeColor: 'text-orange-300',
    activeBg:    'bg-orange-900/30 border-orange-700',
    icon:        <MinusCircle size={16} />,
  },
  {
    status:      'SKIPPED',
    label:       'Skip',
    color:       'text-gray-400 hover:text-gray-300 border-gray-700 hover:border-gray-600',
    activeColor: 'text-gray-300',
    activeBg:    'bg-gray-800 border-gray-600',
    icon:        <SkipForward size={16} />,
  },
]

const PRIORITY_COLORS: Record<string, string> = {
  LOW:      'bg-gray-700 text-gray-300',
  MEDIUM:   'bg-blue-900/50 text-blue-300',
  HIGH:     'bg-orange-900/50 text-orange-300',
  CRITICAL: 'bg-red-900/50 text-red-300',
}

// ─── Timer Hook ───────────────────────────────────────────────────────────────

function useTimer() {
  const [seconds,  setSeconds]  = useState(0)
  const [running,  setRunning]  = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = () => {
    if (running) return
    setRunning(true)
    intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
  }

  const pause = () => {
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  const reset = () => { pause(); setSeconds(0) }

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  const fmt = (s: number) => {
    const h   = Math.floor(s / 3600)
    const m   = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return { seconds, running, start, pause, reset, fmt }
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepDot({ stepNum, status, isCurrent, onClick }: {
  stepNum: number; status: StepStatus; isCurrent: boolean; onClick: () => void
}) {
  const colors: Record<StepStatus, string> = {
    PENDING: isCurrent ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-500 border border-gray-700',
    PASS:    'bg-emerald-600 text-white',
    FAIL:    'bg-red-600 text-white',
    BLOCKED: 'bg-orange-600 text-white',
    SKIPPED: 'bg-gray-600 text-white',
  }
  return (
    <button onClick={onClick} title={`Step ${stepNum} — ${status}`}
      className={`w-7 h-7 rounded-full text-[11px] font-bold flex items-center justify-center transition shrink-0 ${colors[status]} ${isCurrent ? 'ring-2 ring-offset-2 ring-offset-gray-950 ring-emerald-500' : 'hover:opacity-80'}`}>
      {status === 'PASS'    ? <CheckCircle2 size={13} /> :
       status === 'FAIL'    ? <XCircle size={13} /> :
       status === 'BLOCKED' ? <MinusCircle size={13} /> :
       status === 'SKIPPED' ? <SkipForward size={13} /> :
       stepNum}
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExecuteTest() {
  const { testCaseId }  = useParams<{ testCaseId: string }>()
  const [searchParams]  = useSearchParams()
  const navigate        = useNavigate()

  // ✅ projectId from URL or fallback to last visited project in localStorage
  const projectIdParam  = searchParams.get('projectId')

  const [testCase,       setTestCase]       = useState<TestCase | null>(null)
  const [execution,      setExecution]      = useState<Execution | null>(null)
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([])
  const [loadError,      setLoadError]      = useState('')
  const [loadingInit,    setLoadingInit]    = useState(true)

  const [currentStepIdx, setCurrentStepIdx] = useState(0)
  const [savingStep,     setSavingStep]      = useState(false)
  const [completing,     setCompleting]      = useState(false)
  const [completed,      setCompleted]       = useState(false)
  const [finalStatus,    setFinalStatus]     = useState<ExecStatus | null>(null)
  const [stepError,      setStepError]       = useState('')

  const [actualResults, setActualResults] = useState<Record<number, string>>({})
  const [stepStatuses,  setStepStatuses]  = useState<Record<number, StepStatus>>({})

  const timer = useTimer()

  // ── resolved projectId: URL param > testCase.projectId > localStorage ──
  const resolvedProjectId =
    projectIdParam ||
    (testCase?.projectId ? String(testCase.projectId) : null) ||
    localStorage.getItem('lastProjectId') ||
    ''

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!testCaseId) return
    const init = async () => {
      setLoadingInit(true)
      setLoadError('')
      try {
        const { data: tc } = await api.get(`/test-cases/${testCaseId}`)
        setTestCase(tc)

        // Store projectId for later use
        if (tc.projectId) localStorage.setItem('lastProjectId', String(tc.projectId))

        const { data } = await api.post('/executions', { testCaseId: parseInt(testCaseId!) })
        setExecution(data)
        setExecutionSteps(data.stepResults ?? [])

        const statusMap: Record<number, StepStatus> = {}
        const resultMap: Record<number, string>     = {}
        ;(data.stepResults ?? []).forEach((es: any) => {
          statusMap[es.stepId] = es.status ?? 'PENDING'
          resultMap[es.stepId] = es.actualResult ?? ''
        })
        setStepStatuses(statusMap)
        setActualResults(resultMap)
        timer.start()
      } catch (err: any) {
        setLoadError(err?.response?.data?.message || 'Failed to start execution')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [testCaseId])

  // ─── Mark Step ───────────────────────────────────────────────────────────────
  const markStep = async (status: StepStatus) => {
    if (!execution || !currentStep) return
    const exStep = executionSteps.find((es: any) => es.stepId === currentStep.id)
    if (!exStep) return
    setSavingStep(true)
    setStepError('')
    try {
      await api.put(`/executions/${execution.id}/steps/${exStep.stepId}`, {
        status,
        actualResult: actualResults[currentStep.id] ?? '',
      })
      setStepStatuses(prev => ({ ...prev, [currentStep.id]: status }))
      const nextIdx = steps.findIndex(
        (s, i) => i > currentStepIdx && (stepStatuses[s.id] ?? 'PENDING') === 'PENDING'
      )
      if (nextIdx !== -1) setCurrentStepIdx(nextIdx)
    } catch {
      setStepError('Failed to save step result')
    } finally {
      setSavingStep(false)
    }
  }

  // ─── Complete ────────────────────────────────────────────────────────────────
  const completeExecution = async () => {
    if (!execution) return
    setCompleting(true)
    setStepError('')
    try {
      const { data } = await api.put(`/executions/${execution.id}/complete`, { timeSpent: timer.seconds })
      timer.pause()
      setFinalStatus(data.status)
      setCompleted(true)
    } catch {
      setStepError('Failed to complete execution')
    } finally {
      setCompleting(false)
    }
  }

  const steps        = testCase?.steps ?? []
  const currentStep  = steps[currentStepIdx]
  const doneCount    = steps.filter(s => (stepStatuses[s.id] ?? 'PENDING') !== 'PENDING').length
  const allDone      = doneCount === steps.length && steps.length > 0
  const progress     = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0
  const hasFail      = Object.values(stepStatuses).some(s => s === 'FAIL')
  const hasBlocked   = Object.values(stepStatuses).some(s => s === 'BLOCKED')

  // ── Loading ──
  if (loadingInit) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-gray-400">
      <Loader2 size={36} className="animate-spin text-emerald-500" />
      <p className="text-sm">Starting execution…</p>
    </div>
  )

  // ── Error ──
  if (loadError || !testCase || !execution) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <AlertCircle size={36} className="text-red-400" />
      <p className="text-red-300 text-sm">{loadError || 'Something went wrong'}</p>
      <button onClick={() => navigate(-1)}
        className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm transition">
        Go Back
      </button>
    </div>
  )

  // ── Completed screen ──
  if (completed && finalStatus) {
    const statusMeta: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
      PASS:    { label: 'Passed',  color: 'text-emerald-400', icon: <CheckCheck  size={48} className="text-emerald-400" />, desc: 'All steps passed successfully.' },
      FAIL:    { label: 'Failed',  color: 'text-red-400',     icon: <XCircle     size={48} className="text-red-400" />,     desc: 'One or more steps failed.' },
      BLOCKED: { label: 'Blocked', color: 'text-orange-400',  icon: <MinusCircle size={48} className="text-orange-400" />, desc: 'Execution was blocked on one or more steps.' },
    }
    const sm = statusMeta[finalStatus] ?? statusMeta.FAIL

    // ✅ Build Report Bug URL with projectId
    const reportBugUrl = `/bugs/new?testCaseId=${testCase.id}&executionId=${execution.id}${resolvedProjectId ? `&projectId=${resolvedProjectId}` : ''}`
    const backUrl      = resolvedProjectId ? `/test-cases?projectId=${resolvedProjectId}` : '/test-cases'

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-6">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="flex justify-center mb-4">{sm.icon}</div>
          <h2 className={`text-3xl font-bold mb-2 ${sm.color}`}>{sm.label}</h2>
          <p className="text-gray-400 text-sm mb-6">{sm.desc}</p>

          <div className="flex justify-center gap-4 mb-6 text-sm">
            {[
              { label: 'Pass',    color: 'text-emerald-400', s: 'PASS' },
              { label: 'Fail',    color: 'text-red-400',     s: 'FAIL' },
              { label: 'Blocked', color: 'text-orange-400',  s: 'BLOCKED' },
              { label: 'Skipped', color: 'text-gray-400',    s: 'SKIPPED' },
            ].map(({ label, color, s }) => (
              <span key={s} className={`flex items-center gap-1.5 ${color}`}>
                {s === 'PASS'    && <CheckCircle2 size={14} />}
                {s === 'FAIL'    && <XCircle size={14} />}
                {s === 'BLOCKED' && <MinusCircle size={14} />}
                {s === 'SKIPPED' && <SkipForward size={14} />}
                {Object.values(stepStatuses).filter(v => v === s).length} {label}
              </span>
            ))}
          </div>

          <div className="text-xs text-gray-600 mb-6">
            Duration: <span className="text-gray-400">{timer.fmt(timer.seconds)}</span>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(backUrl)}
              className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm transition">
              Back to Test Cases
            </button>
            {hasFail && (
              // ✅ projectId now included
              <button onClick={() => navigate(reportBugUrl)}
                className="flex-1 px-4 py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition">
                Report Bug
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Execution UI ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { if (confirm('Exit execution? Progress will be lost.')) navigate(-1) }}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-emerald-400" />
            <span className="text-sm font-semibold text-white truncate max-w-xs">{testCase.title}</span>
          </div>
          {testCase.module && (
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{testCase.module}</span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[testCase.priority] || ''}`}>
            {testCase.priority}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-800 rounded-xl px-4 py-2">
            <Clock size={14} className={timer.running ? 'text-emerald-400' : 'text-gray-500'} />
            <span className="text-sm font-mono text-white min-w-[52px] text-center">{timer.fmt(timer.seconds)}</span>
            <button onClick={timer.running ? timer.pause : timer.start}
              className="text-gray-400 hover:text-white transition ml-1" title={timer.running ? 'Pause' : 'Resume'}>
              {timer.running ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button onClick={timer.reset} className="text-gray-600 hover:text-gray-400 transition" title="Reset">
              <RotateCcw size={12} />
            </button>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-gray-400">
            <span>{doneCount}/{steps.length}</span>
            <div className="w-24 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${hasFail ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${progress}%` }} />
            </div>
            <span>{progress}%</span>
          </div>
        </div>
      </div>

      {/* Step Dots */}
      <div className="bg-gray-900/50 border-b border-gray-800 px-6 py-3 flex items-center gap-2 overflow-x-auto shrink-0">
        {steps.map((step, i) => (
          <StepDot key={step.id} stepNum={step.stepNumber}
            status={stepStatuses[step.id] ?? 'PENDING'} isCurrent={i === currentStepIdx}
            onClick={() => setCurrentStepIdx(i)} />
        ))}
        {steps.length === 0 && <span className="text-xs text-gray-600">No steps defined</span>}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">

        {/* Left: Step Detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {currentStep ? (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-900/40 border border-emerald-800 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-emerald-400">{currentStep.stepNumber}</span>
                </div>
                <p className="text-[10px] uppercase tracking-widest text-gray-600 font-medium">
                  Step {currentStep.stepNumber} of {steps.length}
                </p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium flex items-center gap-1.5">
                  <CircleDot size={11} /> Action
                </p>
                <p className="text-sm text-white leading-relaxed">{currentStep.action}</p>
              </div>

              {currentStep.testData && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium flex items-center gap-1.5">
                    <AlignLeft size={11} /> Test Data
                  </p>
                  <pre className="text-sm text-blue-300 font-mono whitespace-pre-wrap break-words bg-gray-950/50 rounded-lg p-3">
                    {currentStep.testData}
                  </pre>
                </div>
              )}

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium flex items-center gap-1.5">
                  <Flag size={11} /> Expected Result
                </p>
                <p className="text-sm text-gray-300 leading-relaxed">{currentStep.expectedResult}</p>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium flex items-center gap-1.5">
                  <AlignLeft size={11} /> Actual Result
                  <span className="text-gray-700 normal-case tracking-normal">(fill before marking)</span>
                </p>
                <textarea
                  value={actualResults[currentStep.id] ?? ''}
                  onChange={e => setActualResults(prev => ({ ...prev, [currentStep.id]: e.target.value }))}
                  placeholder="Describe what actually happened…"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              {currentStep.notes && (
                <div className="border border-dashed border-gray-800 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1 font-medium">Note</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{currentStep.notes}</p>
                </div>
              )}

              {stepError && (
                <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm">
                  <AlertCircle size={14} /> {stepError}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {STEP_OPTIONS.map(opt => {
                  const current  = stepStatuses[currentStep.id] ?? 'PENDING'
                  const isActive = current === opt.status
                  return (
                    <button key={opt.status} onClick={() => markStep(opt.status)} disabled={savingStep}
                      className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition disabled:opacity-40 ${
                        isActive ? `${opt.activeBg} ${opt.activeColor}` : `bg-gray-900 ${opt.color}`
                      }`}>
                      {savingStep && isActive ? <RefreshCw size={14} className="animate-spin" /> : opt.icon}
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
              <ClipboardList size={32} />
              <p className="text-sm">No steps to execute</p>
            </div>
          )}
        </div>

        {/* Right: Sidebar */}
        <div className="lg:w-72 bg-gray-900/50 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col shrink-0">
          {testCase.preconditions && (
            <div className="px-5 py-4 border-b border-gray-800">
              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-medium">Preconditions</p>
              <p className="text-xs text-gray-400 leading-relaxed">{testCase.preconditions}</p>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-3 font-medium">All Steps</p>
            <div className="space-y-1.5">
              {steps.map((step, i) => {
                const status   = stepStatuses[step.id] ?? 'PENDING'
                const isCurr   = i === currentStepIdx
                const statusIcon: Record<StepStatus, React.ReactNode> = {
                  PENDING: <div className="w-4 h-4 rounded-full border border-gray-600" />,
                  PASS:    <CheckCircle2 size={15} className="text-emerald-400" />,
                  FAIL:    <XCircle      size={15} className="text-red-400" />,
                  BLOCKED: <MinusCircle  size={15} className="text-orange-400" />,
                  SKIPPED: <SkipForward  size={15} className="text-gray-500" />,
                }
                return (
                  <button key={step.id} onClick={() => setCurrentStepIdx(i)}
                    className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-left transition ${
                      isCurr ? 'bg-gray-800 border border-gray-700' : 'hover:bg-gray-800/50'
                    }`}>
                    <span className="shrink-0 mt-0.5">{statusIcon[status]}</span>
                    <div className="min-w-0">
                      <span className="text-xs text-gray-500 block">Step {step.stepNumber}</span>
                      <span className={`text-xs leading-snug line-clamp-2 ${isCurr ? 'text-white' : 'text-gray-400'}`}>
                        {step.action}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="px-5 py-4 border-t border-gray-800 space-y-3 shrink-0">
            <div className="flex gap-2">
              <button onClick={() => setCurrentStepIdx(i => Math.max(0, i - 1))} disabled={currentStepIdx === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-sm text-gray-300 transition">
                <ChevronLeft size={15} /> Prev
              </button>
              <button onClick={() => setCurrentStepIdx(i => Math.min(steps.length - 1, i + 1))} disabled={currentStepIdx === steps.length - 1}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-30 rounded-xl text-sm text-gray-300 transition">
                Next <ChevronRight size={15} />
              </button>
            </div>

            <button onClick={completeExecution} disabled={!allDone || completing}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition ${
                allDone
                  ? hasFail    ? 'bg-red-700 hover:bg-red-600 text-white'
                  : hasBlocked ? 'bg-orange-700 hover:bg-orange-600 text-white'
                               : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}>
              {completing
                ? <><RefreshCw size={15} className="animate-spin" /> Completing…</>
                : allDone
                ? <><CheckCheck size={15} /> Complete Execution</>
                : <>{doneCount}/{steps.length} steps done</>
              }
            </button>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1">
              {[
                { label: 'Pass',    s: 'PASS',    color: 'text-emerald-400' },
                { label: 'Fail',    s: 'FAIL',    color: 'text-red-400' },
                { label: 'Blocked', s: 'BLOCKED', color: 'text-orange-400' },
                { label: 'Skipped', s: 'SKIPPED', color: 'text-gray-500' },
              ].map(({ label, s, color }) => (
                <div key={s} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-600">{label}</span>
                  <span className={`font-semibold ${color}`}>
                    {Object.values(stepStatuses).filter(v => v === s).length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}