import { useEffect, useState } from "react"

function Dashboard() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")

    fetch("http://localhost:5000/testcases/dashboard/summary", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(setData)
  }, [])

  if (!data) return <p>Loading...</p>

  return (
    <div style={{ padding: 30 }}>
      <h2>Dashboard</h2>

      <p>Total Testcases: {data.totalTestcases}</p>
      <p>Total Executions: {data.totalExecutions}</p>
      <p>PASS: {data.passCount}</p>
      <p>FAIL: {data.failCount}</p>
      <p>Pass Rate: {data.passRate}%</p>
    </div>
  )
}

export default Dashboard
