import { useEffect, useState } from "react"

function Testcases() {
  const [testcases, setTestcases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const token = localStorage.getItem("token")

  useEffect(() => {
    fetch("http://localhost:5000/testcases", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setTestcases(data)
        setLoading(false)
      })
      .catch(err => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  // EXECUTE FUNCTION
  const execute = async (id: number, status: string) => {
    await fetch(`http://localhost:5000/testcases/${id}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    })

    alert("Execution recorded")
  }

  return (
    <div style={{ padding: "20px" }}>
      <h2>Testcases</h2>

      {loading && <p>Loading...</p>}

      {!loading && testcases.length === 0 && (
        <p>No testcases found</p>
      )}

      {!loading && testcases.length > 0 && (
        <table border={1} cellPadding={8}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Priority</th>
              <th>Execute</th> 
            </tr>
          </thead>
          <tbody>
            {testcases.map(tc => (
              <tr key={tc.id}>
                <td>{tc.id}</td>
                <td>{tc.title}</td>
                <td>{tc.priority}</td>
                <td>
                  <button onClick={() => execute(tc.id, "PASS")}>
                    Pass
                  </button>
                  <button onClick={() => execute(tc.id, "FAIL")}>
                    Fail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default Testcases
