import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import axios from "axios"

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isJustRegistered = searchParams.get("registered") === "true"
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"pending" | "loading" | "success" | "error">(
    // If they just registered with no token yet, show "check your email" state
    isJustRegistered && !token ? "pending" : "loading"
  )

  useEffect(() => {
    if (!token) return // No token = just registered, show pending screen

    const verify = async () => {
      try {
        await axios.get(`http://localhost:5000/auth/verify-email?token=${token}`)
        setStatus("success")
        setTimeout(() => navigate("/login"), 2500)
      } catch {
        setStatus("error")
      }
    }

    verify()
  }, [token, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .ve-wrap { font-family: 'DM Sans', sans-serif; }
        .ve-title { font-family: 'Sora', sans-serif; }
        .spin {
          width: 52px; height: 52px;
          border: 4px solid #d1faf4;
          border-top-color: #2ec4a9;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-primary {
          background: linear-gradient(135deg, #2ec4a9, #1a9e87);
          color: white; border: none; border-radius: 50px;
          padding: 13px 40px; font-size: 14px; font-weight: 600;
          cursor: pointer; transition: opacity 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-primary:hover { opacity: 0.88; }
      `}</style>

      <div className="ve-wrap bg-white rounded-3xl shadow-2xl p-12 w-full max-w-md text-center">

        {/* Pending — just registered, awaiting email click */}
        {status === "pending" && (
          <>
            <div className="text-6xl mb-6">📬</div>
            <h2 className="ve-title text-2xl font-bold text-gray-800 mb-3">Check your email</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-8">
              We've sent a verification link to<br />
              <span className="text-emerald-600 font-semibold">{searchParams.get("email") || "your email address"}</span>.
              <br /><br />
              Click the link in the email to verify your account, then come back to sign in.
            </p>
            <button className="btn-primary" onClick={() => navigate("/login")}>
              Go to Login
            </button>
          </>
        )}

        {/* Verifying */}
        {status === "loading" && (
          <>
            <div className="flex justify-center mb-6"><div className="spin" /></div>
            <h2 className="ve-title text-2xl font-bold text-gray-800 mb-3">Verifying your email…</h2>
            <p className="text-gray-400 text-sm">Please wait a moment.</p>
          </>
        )}

        {/* Success */}
        {status === "success" && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2ec4a9" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <h2 className="ve-title text-2xl font-bold text-emerald-600 mb-3">Email Verified!</h2>
            <p className="text-gray-400 text-sm">Redirecting you to login…</p>
          </>
        )}

        {/* Error */}
        {status === "error" && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f25c5c" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </div>
            <h2 className="ve-title text-2xl font-bold text-red-500 mb-3">Verification Failed</h2>
            <p className="text-gray-500 text-sm mb-8">The link is invalid or has expired.</p>
            <button className="btn-primary" onClick={() => navigate("/login")}>
              Go to Login
            </button>
          </>
        )}

      </div>
    </div>
  )
}