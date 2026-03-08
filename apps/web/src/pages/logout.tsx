import { useEffect } from "react"
import { useNavigate } from "react-router-dom"

export default function Logout() {
  const navigate = useNavigate()

  useEffect(() => {
    const logout = async () => {
      try {
        const refreshToken = localStorage.getItem("refreshToken")

        if (refreshToken) {
          await fetch("http://localhost:5000/auth/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken }),
          })
        }
      } catch (error) {
        console.error("Logout error:", error)
      } finally {
        // Clear everything
        localStorage.removeItem("accessToken")
        localStorage.removeItem("refreshToken")
        localStorage.removeItem("user")

        navigate("/login")
      }
    }

    logout()
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">

      <div className="bg-white shadow-xl rounded-2xl p-10 text-center">

        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Logging you out...
        </h2>

        <p className="text-gray-500">
          Please wait while we end your session.
        </p>

      </div>

    </div>
  )
}