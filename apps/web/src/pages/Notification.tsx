import { useEffect, useRef, useState } from "react"
import { Bell } from "lucide-react"
import api from "../lib/api"
import { useAuth } from "../context/AuthContext"

interface Notification {
  id:        number
  type:      string
  title:     string
  message:   string
  isRead:    boolean
  createdAt: string
}

const NotificationBell = () => {
  const { isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [open,          setOpen]          = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
    try {
      const { data } = await api.get("/notifications")
      setNotifications(data.data ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch (err) {
      console.error("Error fetching notifications", err)
    }
  }

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`)
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error("Error marking notification read", err)
    }
  }

  const markAllAsRead = async () => {
    try {
      await api.put("/notifications/read-all")
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      console.error("Error marking all read", err)
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Only fetch when authenticated
  useEffect(() => {
    if (isAuthenticated) fetchNotifications()
  }, [isAuthenticated])

  if (!isAuthenticated) return null

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition"
      >
        <Bell size={22} className="text-gray-500" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-gray-800">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-1 text-xs text-emerald-600">({unreadCount} new)</span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">No notifications yet</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} onClick={() => !n.isRead && markAsRead(n.id)}
                  className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition flex items-start gap-2 ${
                    !n.isRead ? "bg-emerald-50/50" : ""
                  }`}
                >
                  {!n.isRead && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  )}
                  <div className={!n.isRead ? "" : "ml-4"}>
                    <p className="text-sm font-medium text-gray-800">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="text-center px-4 py-3 border-t border-gray-100">
            <a href="/notifications" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              View All
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell