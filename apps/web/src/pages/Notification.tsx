import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Bell, Bug, CheckCircle2, XCircle, RotateCcw,
  MessageSquare, UserCheck, ShieldCheck, X, CheckCheck, RefreshCw
} from "lucide-react"
import api from "../lib/api"

interface Notification {
  id:        number
  type:      string
  title:     string
  message:   string
  isRead:    boolean
  createdAt: string
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  BUG_ASSIGNED:    { icon: <UserCheck     size={14} />, color: 'text-blue-600',    bg: 'bg-blue-100'    },
  BUG_ACCEPTED:    { icon: <CheckCircle2  size={14} />, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  BUG_IN_PROGRESS: { icon: <Bug           size={14} />, color: 'text-amber-600',   bg: 'bg-amber-100'   },
  BUG_FIXED:       { icon: <CheckCheck    size={14} />, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  BUG_VERIFIED:    { icon: <ShieldCheck   size={14} />, color: 'text-teal-600',    bg: 'bg-teal-100'    },
  BUG_CLOSED:      { icon: <CheckCircle2  size={14} />, color: 'text-gray-500',    bg: 'bg-gray-100'    },
  BUG_REOPENED:    { icon: <RotateCcw     size={14} />, color: 'text-red-600',     bg: 'bg-red-100'     },
  BUG_WONT_FIX:    { icon: <XCircle       size={14} />, color: 'text-gray-500',    bg: 'bg-gray-100'    },
  BUG_DUPLICATE:   { icon: <XCircle       size={14} />, color: 'text-purple-600',  bg: 'bg-purple-100'  },
  BUG_COMMENT:     { icon: <MessageSquare size={14} />, color: 'text-blue-500',    bg: 'bg-blue-100'    },
}
const FALLBACK_META = { icon: <Bell size={14} />, color: 'text-gray-500', bg: 'bg-gray-100' }

function timeAgo(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function NotifItem({ n, onRead, onDelete }: {
  n:        Notification
  onRead:   (id: number) => void
  onDelete: (e: React.MouseEvent, id: number) => void
}) {
  const meta = TYPE_META[n.type] ?? FALLBACK_META
  return (
    <div
      onClick={() => !n.isRead && onRead(n.id)}
      className={`group flex items-start gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
        !n.isRead ? 'bg-emerald-50/50' : 'bg-white'
      }`}
    >
      <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${meta.bg}`}>
        <span className={meta.color}>{meta.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${!n.isRead ? 'font-semibold text-gray-800' : 'font-medium text-gray-500'}`}>
          {n.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
        <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
      </div>
      <div className="flex flex-col items-center gap-2 shrink-0">
        {!n.isRead && <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />}
        <button
          onClick={e => onDelete(e, n.id)}
          className="opacity-0 group-hover:opacity-100 transition p-0.5 text-gray-300 hover:text-red-400 mt-1"
          title="Dismiss"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [open,          setOpen]          = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [pos,           setPos]           = useState({ top: 0, right: 0 })

  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchNotifications = useCallback(async (silent = false) => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
    if (!silent) setLoading(true)
    try {
      const { data } = await api.get('/notifications?limit=30')
      setNotifications(data.data ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch { /* ignore */ }
    finally { if (!silent) setLoading(false) }
  }, [])

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch { /* ignore */ }
  }

  const markAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all')
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch { /* ignore */ }
  }

  const deleteNotification = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    try {
      await api.delete(`/notifications/${id}`)
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id)
        if (removed && !removed.isRead) setUnreadCount(c => Math.max(0, c - 1))
        return prev.filter(n => n.id !== id)
      })
    } catch { /* ignore */ }
  }

  const handleBellClick = () => {
    if (bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setPos({
        top:   rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen(v => !v)
  }

  // Close on outside click — checks both bell and dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        bellRef.current && !bellRef.current.contains(target) &&
        dropRef.current  && !dropRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Initial load + poll every 20s
  useEffect(() => {
    fetchNotifications()
    pollRef.current = setInterval(() => fetchNotifications(true), 20_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchNotifications])

  useEffect(() => { if (open) fetchNotifications() }, [open, fetchNotifications])

  const unread = notifications.filter(n => !n.isRead)
  const read   = notifications.filter(n =>  n.isRead)

  const dropdown = open ? (
    <div
      ref={dropRef}
      style={{
        position:        'fixed',
        top:             pos.top,
        right:           pos.right,
        width:           '22rem',
        maxHeight:       '32rem',
        zIndex:          2147483647, // maximum possible z-index
        display:         'flex',
        flexDirection:   'column',
        borderRadius:    '1rem',
        overflow:        'hidden',
        backgroundColor: '#ffffff',
        border:          '1px solid #e5e7eb',
        boxShadow:       '0 25px 50px -12px rgba(0,0,0,0.25)',
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '1px solid #f3f4f6', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1f2937' }}>Notifications</span>
          {unreadCount > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 999 }}>
              {unreadCount} new
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} style={{ fontSize: 12, color: '#059669', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>
              Mark all read
            </button>
          )}
          <button onClick={() => fetchNotifications()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }} title="Refresh">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }}>
        {loading && notifications.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '48px 0' }}>
            <RefreshCw size={20} className="animate-spin" style={{ color: '#34d399' }} />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: 8 }}>
            <Bell size={32} style={{ color: '#e5e7eb' }} />
            <p style={{ fontSize: 14, color: '#9ca3af' }}>No notifications yet</p>
          </div>
        ) : (
          <>
            {unread.length > 0 && (
              <>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', fontWeight: 600, padding: '12px 16px 4px' }}>New</p>
                {unread.map(n => <NotifItem key={n.id} n={n} onRead={markAsRead} onDelete={deleteNotification} />)}
              </>
            )}
            {read.length > 0 && (
              <>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', fontWeight: 600, padding: '12px 16px 4px' }}>Earlier</p>
                {read.map(n => <NotifItem key={n.id} n={n} onRead={markAsRead} onDelete={deleteNotification} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        ref={bellRef}
        onClick={handleBellClick}
        className="relative p-2 rounded-xl hover:bg-emerald-50 transition"
      >
        <Bell size={20} className={unreadCount > 0 ? 'text-emerald-600' : 'text-gray-400'} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold px-1 rounded-full leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Portal — renders directly into document.body, above EVERYTHING */}
      {createPortal(dropdown, document.body)}
    </>
  )
}