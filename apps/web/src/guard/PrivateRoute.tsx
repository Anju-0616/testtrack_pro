import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface PrivateRouteProps {
  roles?: ('TESTER' | 'DEVELOPER')[]
}

export default function PrivateRoute({ roles }: PrivateRouteProps) {
  const { user, loading, isAuthenticated } = useAuth()

  // Always wait for auth to finish loading before making any decisions
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  // Only check roles after we're sure user is fully loaded
  if (roles && roles.length > 0) {
    if (!user || !roles.includes(user.role)) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <Outlet />
}