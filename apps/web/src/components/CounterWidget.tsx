import React from "react"

interface CounterWidgetProps {
  title: string
  value: number
  icon?: React.ReactNode
  accent?: string
}

export default function CounterWidget({
  title,
  value,
  icon,
  accent = "from-emerald-500 to-teal-600"
}: CounterWidgetProps) {
  return (
    <div className="relative bg-white rounded-2xl p-6 shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
          <p className="text-4xl font-bold text-gray-800">{value}</p>
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center text-white shadow-sm`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}