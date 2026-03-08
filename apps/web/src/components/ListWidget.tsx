type Item = {
  id: number
  title: string
  executedAt: string
}

type Props = {
  title: string
  items: Item[]
}

export default function ListWidget({ title, items }: Props) {
  return (
    <div className="bg-white shadow-lg rounded-xl p-6">
      <h3 className="text-gray-700 font-semibold mb-4">
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="text-gray-400 text-sm">No data available</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="border-b pb-2 text-sm">
              <div className="font-medium">{item.title}</div>
              <div className="text-gray-400 text-xs">
                {new Date(item.executedAt).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}