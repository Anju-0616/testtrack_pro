import { useEffect, useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import {
  FolderKanban, LayoutDashboard, ClipboardList, ListChecks,
  Play, CheckCircle, Bug, Flag, BarChart2,
  RefreshCw, AlertCircle, FlaskConical, Siren, ClipboardCheck
} from "lucide-react"
import CounterWidget from "../components/CounterWidget"
import TableWidget from "../components/TableWidget"
import NotificationBell from "../pages/Notification"
import { useAuth } from "../context/AuthContext"

const NAV = [
  { to: "/projects",         icon: <FolderKanban size={17} />,    label: "All Projects" },
  { to: "/tester-dashboard", icon: <LayoutDashboard size={17} />, label: "Dashboard" },
  { to: "/test-cases",       icon: <ClipboardList size={17} />,   label: "Test Cases" },
  { to: "/test-suites",      icon: <ListChecks size={17} />,      label: "Test Suites" },
  { to: "/test-runs",        icon: <Play size={17} />,            label: "Test Runs" },
  { to: "/executions",       icon: <CheckCircle size={17} />,     label: "Executions" },
  { to: "/bugs",             icon: <Bug size={17} />,             label: "Bugs" },
  { to: "/milestones",       icon: <Flag size={17} />,            label: "Milestones" },
  { to: "/reports",          icon: <BarChart2 size={17} />,       label: "Reports" },
]

export default function TesterDashboard() {
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    const token = localStorage.getItem("accessToken")
    if (!token) {
      setError("Not authenticated"); setLoading(false); return
    }
    try {
      const res = await fetch("http://localhost:5000/dashboard/tester", {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`Server error: ${res.status}`)
      setData(await res.json())
    } catch (err: any) {
      setError(err.message ?? "Failed to load dashboard")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="flex flex-col items-center gap-3 text-emerald-600">
        <RefreshCw size={28} className="animate-spin" />
        <p className="text-sm text-gray-400">Loading dashboard…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      <div className="text-center">
        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={load} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">
          Retry
        </button>
      </div>
    </div>
  )

  const initials = user?.name?.[0]?.toUpperCase() ?? "?"

  // recentFailures: matches data.recentFailures[].testcase.title, .executedAt
  const failureRows = (data?.recentFailures ?? []).map((item: any) => ({
    title:      item?.testcase?.title ?? "Unknown test",
    executedAt: item?.executedAt ? new Date(item.executedAt).toLocaleDateString() : "—",
  }))

  return (
    <div className="flex h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">

      {/* SIDEBAR */}
      <aside className="w-64 bg-gradient-to-b from-emerald-600 to-teal-700 text-white flex flex-col justify-between py-8 px-5 shadow-xl shrink-0">
        <div>
          <div className="flex items-center gap-2.5 mb-10 px-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Bug size={16} /></div>
            <span className="text-lg font-bold tracking-wide">TestTrack</span>
          </div>
          <nav className="space-y-1 text-sm">
            {NAV.map(({ to, icon, label }) => (
              <NavLink key={to} to={to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                    isActive ? "bg-white text-emerald-700 font-semibold shadow-sm"
                             : "text-white/80 hover:bg-white/15 hover:text-white"
                  }`
                }
              >{icon}{label}</NavLink>
            ))}
          </nav>
        </div>
        <div onClick={() => navigate("/profile")}
          className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer hover:bg-white/15 transition">
          <div className="w-9 h-9 rounded-full bg-white text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0">{initials}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-white/60">{user?.role}</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center justify-end px-8 py-4 bg-white/80 backdrop-blur border-b border-gray-100 shadow-sm">
          <NotificationBell />
        </div>

        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-800">Tester Dashboard</h1>
            <p className="text-sm text-gray-400 mt-1">Your testing activity at a glance</p>
          </div>

          {/* Counters — matches: data.counters.myExecutions, .myBugs, .pendingTests */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div onClick={() => navigate("/executions")} className="cursor-pointer">
              <CounterWidget title="My Executions" value={data?.counters?.myExecutions ?? 0}
                icon={<FlaskConical size={18} />} accent="from-emerald-500 to-teal-600" />
            </div>
            <div onClick={() => navigate("/bugs")} className="cursor-pointer">
              <CounterWidget title="Bugs Reported" value={data?.counters?.myBugs ?? 0}
                icon={<Siren size={18} />} accent="from-red-400 to-rose-500" />
            </div>
            <div onClick={() => navigate("/test-cases?status=READY")} className="cursor-pointer">
              <CounterWidget title="Pending Tests" value={data?.counters?.pendingTests ?? 0}
                icon={<ClipboardCheck size={18} />} accent="from-amber-400 to-orange-500" />
            </div>
          </div>

          {/* Recent Failures — matches: data.recentFailures[].testcase.title, .executedAt */}
          <TableWidget
            title="Recent Test Failures"
            columns={[
              { header: "Test Case",   accessor: "title"      },
              { header: "Executed At", accessor: "executedAt" },
            ]}
            data={failureRows}
          />

          {/* Execution Trend — matches: data.trend[].date, .count */}
          {/* Add a trend chart here if you have one, e.g: */}
          {/* <FixTrendChart data={data?.trend ?? []} /> */}
        </main>
      </div>
    </div>
  )
}