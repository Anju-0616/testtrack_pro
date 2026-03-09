import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import PrivateRoute from './guard/PrivateRoute'

import Login          from './pages/login'
import Register       from './pages/register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword  from './pages/ResetPassword'
import VerifyEmail    from './pages/VerifyEmail'
import Logout         from './pages/logout'

import Testcases          from './pages/Testcases'
import TestCaseForm       from './pages/TestCaseForm'
import ExecutionInterface from './pages/ExecutionInterface'
import Bugs               from './pages/bugs'
import CreateBug          from './pages/CreateBug'
import Reports            from './pages/Reports'
import Notification       from './pages/Notification'
import Settings           from './pages/settings'
import Profile            from './pages/Profile'
import DeveloperDashboard from './pages/DeveloperDashboard'
import TesterDashboard    from './pages/TesterDashboard'
import TestSuites         from './pages/TestSuites'
import TestRuns           from './pages/TestRuns'
import ExecuteTest        from './pages/Executetest'
import Milestones         from './pages/Milestones'
import Projects           from './pages/Project'
import ProjectDetail      from './pages/ProjectDetails'
import AssignedBugs       from './pages/assignedbugs'

import Layout from './components/Layout'

function RoleRedirect() {
  const { user } = useAuth()
  if (user?.role === 'DEVELOPER') return <Navigate to="/developer-dashboard" replace />
  if (user?.role === 'TESTER')    return <Navigate to="/dashboard"           replace />
  return <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* ── Public ───────────────────────────────────────────────────── */}
          <Route path="/login"           element={<Login />} />
          <Route path="/register"        element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/verify-email"    element={<VerifyEmail />} />
          <Route path="/logout"          element={<Logout />} />

          {/* ── All protected routes — inside Layout ─────────────────────── */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>

              {/* Root redirects */}
              <Route path="/"          element={<RoleRedirect />} />
              <Route path="/dashboard" element={<RoleRedirect />} />

              {/* Dashboards — now inside Layout so NotificationBell works */}
              <Route path="/developer-dashboard" element={<DeveloperDashboard />} />
              <Route path="/tester-dashboard"    element={<TesterDashboard />} />

              {/* Shared pages */}
              <Route path="/test-cases"                     element={<Testcases />} />
              <Route path="/test-cases/new"                 element={<TestCaseForm />} />
              <Route path="/test-cases/:id/edit"            element={<TestCaseForm />} />
              <Route path="/test-cases/:testCaseId/execute" element={<ExecutionInterface />} />
              <Route path="/bugs"                           element={<Bugs />} />
              <Route path="/bugs/new"                       element={<CreateBug />} />
              <Route path="/reports"                        element={<Reports />} />
              <Route path="/notifications"                  element={<Notification />} />
              <Route path="/settings"                       element={<Settings />} />
              <Route path="/profile"                        element={<Profile />} />
              <Route path="/test-suites"                    element={<TestSuites />} />
              <Route path="/test-runs"                      element={<TestRuns />} />
              <Route path="/executions"                     element={<ExecuteTest />} />
              <Route path="/milestones"                     element={<Milestones />} />
              <Route path="/projects"                       element={<Projects />} />
              <Route path="/projects/:id"                   element={<ProjectDetail />} />
              <Route path="/execute/:testCaseId"            element={<ExecuteTest />} />
              <Route path="/assigned-bugs"                  element={<AssignedBugs />} />

            </Route>
          </Route>

          {/* ── 403 ──────────────────────────────────────────────────────── */}
          <Route path="/unauthorized" element={
            <div className="flex items-center justify-center min-h-screen bg-gray-950">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-red-400 mb-4">403</h1>
                <p className="text-gray-400 mb-6">You don't have permission to access this page.</p>
                <a href="/dashboard" className="text-emerald-400 hover:text-emerald-300">← Go to Dashboard</a>
              </div>
            </div>
          } />

          {/* ── 404 ──────────────────────────────────────────────────────── */}
          <Route path="*" element={
            <div className="flex items-center justify-center min-h-screen bg-gray-950">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-400 mb-4">404</h1>
                <p className="text-gray-500 mb-6">Page not found.</p>
                <a href="/dashboard" className="text-emerald-400 hover:text-emerald-300">← Go to Dashboard</a>
              </div>
            </div>
          } />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App