interface Column {
  header: string
  accessor: string
}

interface TableWidgetProps {
  title: string
  columns: Column[]
  data: any[]
}

export default function TableWidget({ title, columns, data }: TableWidgetProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-700">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col) => (
                <th
                  key={col.accessor}
                  className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-10 text-center text-sm text-gray-400">
                  No data available
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr key={index} className="hover:bg-emerald-50/40 transition-colors">
                  {columns.map((col) => (
                    <td key={col.accessor} className="px-6 py-3.5 text-sm text-gray-700">
                      {col.accessor === "status" ? (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          row[col.accessor] === "FIXED"   ? "bg-emerald-100 text-emerald-700" :
                          row[col.accessor] === "OPEN"    ? "bg-red-100 text-red-700" :
                          row[col.accessor] === "CLOSED"  ? "bg-gray-100 text-gray-600" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {row[col.accessor]}
                        </span>
                      ) : (
                        row[col.accessor]
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}