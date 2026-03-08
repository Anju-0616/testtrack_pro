import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from "recharts"

type Props = {
  data: { status: string; count: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  OPEN:        "#f87171",
  IN_PROGRESS: "#fb923c",
  FIXED:       "#34d399",
  CLOSED:      "#6ee7b7",
  REOPENED:    "#f472b6",
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3">
        <p className="text-xs text-gray-400 mb-1">{label}</p>
        <p className="text-lg font-bold text-gray-800">{payload[0].value}</p>
      </div>
    )
  }
  return null
}

export default function StatusChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-gray-700 mb-4">Bugs by Status</h3>
        <p className="text-gray-400 text-sm text-center py-10">No status data yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-gray-100 rounded-2xl p-6">
      <h3 className="text-base font-semibold text-gray-700 mb-6">Bugs by Status</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barSize={40}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="status" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f0fdf4" }} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={STATUS_COLORS[entry.status] ?? "#34d399"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}