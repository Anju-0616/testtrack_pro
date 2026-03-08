import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"

export default function Register() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState("TESTER")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleRegister = async () => {
    if (!name || !email || !password) {
      setError("Please fill in all fields")
      return
    }
    setLoading(true)
    setError("")

    try {
      const res = await fetch("http://localhost:5000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      })

      const data = await res.json()

      if (res.ok || data.user || data.message?.toLowerCase().includes("success")) {
        // ✅ Redirect to verify-email page after registration
        navigate("/verify-email?registered=true")
      } else {
        setError(data.message || "Registration failed")
      }
    } catch (err) {
      setError("Server error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Sora:wght@600;700&display=swap');
        .auth-wrap { font-family: 'DM Sans', sans-serif; }
        .auth-title { font-family: 'Sora', sans-serif; }
        .panel-right-reg {
          background: linear-gradient(145deg, #2ec4a9 0%, #1a9e87 60%, #12796a 100%);
        }
        .corner-red {
          position: absolute; top: -32px; left: -32px;
          width: 110px; height: 110px;
          background: #f25c5c; border-radius: 50%; opacity: 0.92;
        }
        .corner-yellow {
          position: absolute; bottom: -28px; right: -28px;
          width: 80px; height: 80px;
          background: #f9c846; border-radius: 50%; opacity: 0.85;
        }
        .input-field {
          width: 100%; border: none; border-bottom: 2px solid #e2e8f0;
          padding: 10px 2px; font-size: 14px; outline: none;
          background: transparent; color: #2d3748;
          transition: border-color 0.2s;
        }
        .input-field:focus { border-color: #2ec4a9; }
        .input-field::placeholder { color: #a0aec0; }
        .role-btn {
          flex: 1; padding: 9px 0; border-radius: 50px; font-size: 13px;
          font-weight: 600; border: 2px solid #e2e8f0; cursor: pointer;
          transition: all 0.2s; background: white; color: #718096;
          font-family: 'DM Sans', sans-serif;
        }
        .role-btn.active {
          background: linear-gradient(135deg, #2ec4a9, #1a9e87);
          border-color: transparent; color: white;
        }
        .btn-primary {
          background: linear-gradient(135deg, #2ec4a9, #1a9e87);
          color: white; border: none; border-radius: 50px;
          padding: 13px 0; width: 100%; font-size: 14px;
          font-weight: 600; letter-spacing: 0.5px; cursor: pointer;
          transition: opacity 0.2s, transform 0.1s;
          font-family: 'DM Sans', sans-serif;
        }
        .btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
        .btn-primary:active { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="auth-wrap relative w-full max-w-3xl mx-4 rounded-3xl shadow-2xl overflow-hidden flex" style={{minHeight: 520}}>

        {/* ── LEFT PANEL (form) ── */}
        <div className="flex-1 bg-white flex flex-col items-center justify-center px-12 py-14">
          <h2 className="auth-title text-2xl font-bold text-gray-800 mb-8">Create Account</h2>

          {error && (
            <div className="w-full mb-5 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <div className="w-full space-y-6">
            <input
              className="input-field"
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <input
              className="input-field"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <input
              className="input-field"
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRegister()}
            />

            {/* Role selector */}
            <div>
              <p className="text-xs text-gray-400 mb-2 ml-1">I am a…</p>
              <div className="flex gap-3">
                <button
                  className={`role-btn ${role === "TESTER" ? "active" : ""}`}
                  onClick={() => setRole("TESTER")}
                >
                  Tester
                </button>
                <button
                  className={`role-btn ${role === "DEVELOPER" ? "active" : ""}`}
                  onClick={() => setRole("DEVELOPER")}
                >
                  Developer
                </button>
              </div>
            </div>
          </div>

          <button className="btn-primary mt-8" onClick={handleRegister} disabled={loading}>
            {loading ? "Creating account…" : "SIGN UP"}
          </button>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="panel-right-reg relative flex flex-col items-center justify-center px-10 py-16 text-white" style={{width: "42%", minWidth: 220}}>
          <div className="corner-red" />
          <div className="corner-yellow" />

          <div className="mb-8 flex items-center gap-2 z-10">
            <div className="w-8 h-8 bg-white/30 rounded-lg flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <span className="auth-title font-bold text-lg tracking-wide">TestTrack</span>
          </div>

          <h2 className="auth-title text-3xl font-bold text-center z-10 mb-4 leading-tight">
            Hello,<br />Friend!
          </h2>
          <p className="text-white/75 text-sm text-center z-10 leading-relaxed mb-10">
            Already have an account?<br />Sign in to get started
          </p>

          <Link
            to="/login"
            className="z-10 border-2 border-white text-white rounded-full px-8 py-2.5 text-sm font-semibold hover:bg-white hover:text-emerald-600 transition-all"
          >
            SIGN IN
          </Link>
        </div>

      </div>
    </div>
  )
}