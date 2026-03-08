import { useEffect, useState } from 'react'
import api from '../lib/api'
import {
  BarChart3, RefreshCw, AlertCircle, Download,
  FileText, FileSpreadsheet, Bug, CheckCircle2,
  Clock, Play
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend
} from 'recharts'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChartEntry {
  priority?: string
  severity?: string
  _count: { priority?: number; severity?: number }
}

interface ReportData {
  summary: {
    total: number
    open: number
    inProgress: number
    fixed: number
  }
  priorityChart: ChartEntry[]
  severityChart: ChartEntry[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  P1_URGENT: '#ef4444',
  P2_HIGH:   '#f97316',
  P3_MEDIUM: '#eab308',
  P4_LOW:    '#6b7280',
}

const SEVERITY_COLORS: Record<string, string> = {
  BLOCKER:  '#dc2626',
  CRITICAL: '#ea580c',
  MAJOR:    '#ca8a04',
  MINOR:    '#3b82f6',
  TRIVIAL:  '#4b5563',
}

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    color: '#111827',
    fontSize: 12,
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  cursor: { fill: 'rgba(0,0,0,0.03)' },
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm shadow-lg">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="text-gray-900 font-semibold">{payload[0].value} bugs</p>
    </div>
  )
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, numColor, iconBg, icon }: {
  label: string
  value: number
  numColor: string
  iconBg: string
  icon: React.ReactNode
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className={`p-2 rounded-lg ${iconBg}`}>{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${numColor}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1 capitalize">{label}</p>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Reports() {
  const [data,      setData]      = useState<ReportData | null>(null)
  const [days,      setDays]      = useState(30)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: res } = await api.get(`/reports?days=${days}`)
      setData(res)
    } catch {
      setError('Failed to load report data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [days])

  const downloadFile = async (endpoint: string, filename: string, type: 'csv' | 'pdf') => {
    setExporting(type)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = window.URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError(`Failed to export ${type.toUpperCase()}`)
    } finally {
      setExporting(null)
    }
  }

  const priorityData = (data?.priorityChart ?? []).map(e => ({
    name:  e.priority ?? '',
    value: e._count?.priority ?? 0,
    color: PRIORITY_COLORS[e.priority ?? ''] ?? '#6b7280',
  }))

  const severityData = (data?.severityChart ?? []).map(e => ({
    name:  e.severity ?? '',
    value: e._count?.severity ?? 0,
    color: SEVERITY_COLORS[e.severity ?? ''] ?? '#6b7280',
  }))

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <BarChart3 size={24} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
              <p className="text-sm text-gray-500">Bug analytics overview</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-blue-400 transition shadow-sm"
            >
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>

            <button
              onClick={() => downloadFile('/reports/export-csv', 'bug-report.csv', 'csv')}
              disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-emerald-400 hover:text-emerald-600 text-gray-600 text-sm font-medium rounded-xl transition disabled:opacity-40 shadow-sm"
            >
              {exporting === 'csv'
                ? <RefreshCw size={14} className="animate-spin" />
                : <FileSpreadsheet size={14} />
              }
              Export CSV
            </button>

            <button
              onClick={() => downloadFile('/reports/export-pdf', 'bug-report.pdf', 'pdf')}
              disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 text-gray-600 text-sm font-medium rounded-xl transition disabled:opacity-40 shadow-sm"
            >
              {exporting === 'pdf'
                ? <RefreshCw size={14} className="animate-spin" />
                : <FileText size={14} />
              }
              Export PDF
            </button>

            <button
              onClick={load}
              disabled={loading}
              className="p-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-400 hover:text-gray-700 rounded-xl transition disabled:opacity-40 shadow-sm"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
            <AlertCircle size={15} /> {error}
            <button onClick={load} className="ml-auto text-xs flex items-center gap-1 font-semibold hover:text-red-700">
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-28">
            <RefreshCw size={30} className="animate-spin text-blue-500" />
          </div>
        ) : !data ? null : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <SummaryCard
                label="Total Bugs"
                value={data.summary.total}
                numColor="text-gray-800"
                iconBg="bg-gray-100"
                icon={<Bug size={16} className="text-gray-500" />}
              />
              <SummaryCard
                label="Open"
                value={data.summary.open}
                numColor="text-blue-600"
                iconBg="bg-blue-100"
                icon={<Play size={16} className="text-blue-600" />}
              />
              <SummaryCard
                label="In Progress"
                value={data.summary.inProgress}
                numColor="text-amber-600"
                iconBg="bg-amber-100"
                icon={<Clock size={16} className="text-amber-600" />}
              />
              <SummaryCard
                label="Fixed"
                value={data.summary.fixed}
                numColor="text-emerald-600"
                iconBg="bg-emerald-100"
                icon={<CheckCircle2 size={16} className="text-emerald-600" />}
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Priority Bar Chart */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-5 flex items-center gap-2">
                  <Download size={14} className="text-gray-400" /> Priority Distribution
                </h3>
                {priorityData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                    <BarChart3 size={28} className="mb-2" />
                    <p className="text-sm text-gray-400">No data for this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={priorityData} barSize={32}>
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} {...CHART_TOOLTIP_STYLE} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {priorityData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Severity Pie Chart */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-5 flex items-center gap-2">
                  <Download size={14} className="text-gray-400" /> Severity Distribution
                </h3>
                {severityData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                    <BarChart3 size={28} className="mb-2" />
                    <p className="text-sm text-gray-400">No data for this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={severityData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={3}
                        label={({ name, percent }) =>
                          `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {severityData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        formatter={(value) => (
                          <span style={{ color: '#6b7280', fontSize: 11 }}>{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Summary table */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 mt-6 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-5">Period Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { label: 'Total',       value: data.summary.total,      bar: 100,                                                                           color: 'bg-gray-400' },
                  { label: 'Open',        value: data.summary.open,       bar: data.summary.total ? (data.summary.open / data.summary.total) * 100 : 0,       color: 'bg-blue-500' },
                  { label: 'In Progress', value: data.summary.inProgress, bar: data.summary.total ? (data.summary.inProgress / data.summary.total) * 100 : 0, color: 'bg-amber-500' },
                  { label: 'Fixed',       value: data.summary.fixed,      bar: data.summary.total ? (data.summary.fixed / data.summary.total) * 100 : 0,      color: 'bg-emerald-500' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500 font-medium">{s.label}</span>
                      <span className="text-xs font-bold text-gray-800">{s.value}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${s.color}`}
                        style={{ width: `${s.bar}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}