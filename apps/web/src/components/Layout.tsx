import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  FolderKanban, LayoutDashboard, ClipboardList,
  Play, Bug, BarChart2, BugPlay, LogOut, User
} from 'lucide-react'
import NotificationBell from '../pages/Notification'
import { useAuth } from '../context/AuthContext'

const DEV_NAV = [
  { to: '/projects',            icon: <FolderKanban size={16} />,    label: 'All Projects' },
  { to: '/developer-dashboard', icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/assigned-bugs',       icon: <BugPlay size={16} />,         label: 'My Assigned Bugs' },
  { to: '/bugs',                icon: <Bug size={16} />,             label: 'All Bugs' },
  { to: '/test-cases',          icon: <ClipboardList size={16} />,   label: 'Test Cases' },
  { to: '/test-runs',           icon: <Play size={16} />,            label: 'Test Runs' },
  { to: '/reports',             icon: <BarChart2 size={16} />,       label: 'Reports' },
]

const TESTER_NAV = [
  { to: '/projects',    icon: <FolderKanban size={16} />,    label: 'All Projects' },
  { to: '/dashboard',   icon: <LayoutDashboard size={16} />, label: 'Dashboard' },
  { to: '/test-cases',  icon: <ClipboardList size={16} />,   label: 'Test Cases' },
  { to: '/test-runs',   icon: <Play size={16} />,            label: 'Test Runs' },
  { to: '/bugs',        icon: <Bug size={16} />,             label: 'Bugs' },
  { to: '/reports',     icon: <BarChart2 size={16} />,       label: 'Reports' },
]

export default function Layout() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const isDev    = user?.role === 'DEVELOPER'
  const nav      = isDev ? DEV_NAV : TESTER_NAV
  const initials = user?.name?.[0]?.toUpperCase() ?? '?'

  const handleLogout = async () => {
    try { await logout?.() } catch {}
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{
      background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 25%, #ffffff 50%, #f0fdfa 75%, #ecfdf5 100%)'
    }}>

      {/* Sidebar */}
      <aside className="w-60 bg-gradient-to-b from-emerald-600 to-teal-700 flex flex-col shrink-0 shadow-xl">

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
            <Bug size={15} className="text-white" />
          </div>
          <span className="text-base font-bold text-white tracking-tight">TestTrack</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40 px-3 pb-2">
            {isDev ? 'Developer' : 'Tester'}
          </p>
          {nav.map(({ to, icon, label }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-emerald-700 font-semibold shadow-sm'
                    : 'text-white/80 hover:bg-white/15 hover:text-white'
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-1">
          <button
            onClick={() => navigate('/profile')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:text-white hover:bg-white/15 transition"
          >
            <div className="w-7 h-7 rounded-full bg-white text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-sm font-medium text-white truncate">{user?.name ?? 'User'}</p>
              <p className="text-[10px] text-white/50 truncate">{user?.role}</p>
            </div>
            <User size={14} className="ml-auto shrink-0 text-white/40" />
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/15 transition"
          >
            <LogOut size={15} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex items-center justify-between px-6 py-3.5 bg-white/70 backdrop-blur-md border-b border-emerald-100/80 shadow-sm shrink-0">
          {/* Breadcrumb-style subtle branding */}
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-gray-400 font-medium">TestTrack</span>
          </div>
          <NotificationBell />
        </header>

        {/* Decorative background layer */}
        <div className="flex-1 overflow-y-auto relative">
          {/* Soft ambient orbs */}
          <div className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
            <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, #6ee7b7 0%, transparent 70%)' }} />
            <div className="absolute top-1/2 -left-24 w-72 h-72 rounded-full opacity-15"
              style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full opacity-10"
              style={{ background: 'radial-gradient(circle, #2dd4bf 0%, transparent 70%)' }} />
          </div>

          {/* Page content sits above decorative layer */}
          <div className="relative" style={{ zIndex: 1 }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}