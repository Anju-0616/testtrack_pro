import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  BugPlay, ShieldAlert, RefreshCw, AlertCircle, CheckCheck, TrendingUp
} from "lucide-react"
import CounterWidget from "../components/CounterWidget"
import TableWidget from "../components/TableWidget"
import api from "../lib/api"

export default function DeveloperDashboard() {
  const navigate = useNavigate()
  const [data,    setData]    = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data: res } = await api.get("/dashboard/developer")
      setData(res)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Failed to load dashboard")
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3 text-emerald-600">
        <RefreshCw size={28} className="animate-spin" />
        <p className="text-sm text-gray-400">Loading dashboard…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center py-24">
      <div className="text-center">
        <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={load} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700">Retry</button>
      </div>
    </div>
  )

  const fixedRows = (data?.recentlyFixed ?? []).map((b: any) => ({
    bugId:  b.bugId  ?? "—",
    title:  b.title  ?? "Untitled",
    status: b.status ?? "FIXED",
  }))

  return (
    <div className="px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Developer Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Your bug workload at a glance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <div onClick={() => navigate("/assigned-bugs")} className="cursor-pointer">
          <CounterWidget title="Bugs Assigned" value={data?.counters?.assigned ?? 0}
            icon={<BugPlay size={18} />} accent="from-emerald-500 to-teal-600" />
        </div>
        <div onClick={() => navigate("/assigned-bugs")} className="cursor-pointer">
          <CounterWidget title="High Priority" value={data?.counters?.highPriority ?? 0}
            icon={<ShieldAlert size={18} />} accent="from-red-400 to-rose-500" />
        </div>
        <div onClick={() => navigate("/assigned-bugs")} className="cursor-pointer">
          <CounterWidget title="In Progress" value={data?.counters?.inProgress ?? 0}
            icon={<TrendingUp size={18} />} accent="from-amber-400 to-orange-500" />
        </div>
        <div onClick={() => navigate("/assigned-bugs")} className="cursor-pointer">
          <CounterWidget title="Fixed" value={data?.counters?.fixed ?? 0}
            icon={<CheckCheck size={18} />} accent="from-blue-400 to-indigo-500" />
        </div>
      </div>

      <TableWidget
        title="Recently Fixed Bugs"
        columns={[
          { header: "Bug ID", accessor: "bugId"  },
          { header: "Title",  accessor: "title"  },
          { header: "Status", accessor: "status" },
        ]}
        data={fixedRows}
      />
    </div>
  )
}