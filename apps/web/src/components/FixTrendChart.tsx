import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from "recharts"

type Props = {
  data: { date: string; count: number }[]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-lg font-bold text-emerald-600">{payload[0].value} fixed</p>
      </div>
    )
  }
  return null
}

export default function FixTrendChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-gray-700 mb-4">Fix Trend</h3>
        <p className="text-gray-400 text-sm text-center py-10">No fix trend data yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6">
      <h3 className="text-base font-semibold text-gray-700 mb-6">Fix Trend Over Time</h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="fixGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#10b981"
            strokeWidth={2.5}
            fill="url(#fixGradient)"
            dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}