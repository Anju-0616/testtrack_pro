import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import {
  User, Mail, Shield, Pencil, X, RefreshCw,
  AlertCircle, CheckCircle2, LogOut, Trash2, KeyRound
} from 'lucide-react'

interface UserProfile {
  id: number
  name: string
  email: string
  role: 'TESTER' | 'DEVELOPER'
}

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  TESTER:    { label: 'Tester',    color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  DEVELOPER: { label: 'Developer', color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200' },
}

function initials(name?: string) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onClose }: {
  title: string; message: string; confirmLabel: string
  confirmColor: string; onConfirm: () => void; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5">
          <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500">{message}</p>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">Cancel</button>
          <button onClick={onConfirm}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-xl transition ${confirmColor}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()

  const [user,        setUser]        = useState<UserProfile | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [editMode,    setEditMode]    = useState(false)
  const [nameInput,   setNameInput]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showLogout,  setShowLogout]  = useState(false)
  const [showDelete,  setShowDelete]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/auth/me')
        setUser(data); setNameInput(data.name)
      } catch { navigate('/login') }
      finally { setLoading(false) }
    }
    load()
  }, [navigate])

  const handleSave = async () => {
    if (!nameInput.trim()) { setSaveError('Name cannot be empty'); return }
    setSaving(true); setSaveError(''); setSaveSuccess(false)
    try {
      const { data } = await api.patch('/auth/me', { name: nameInput.trim() })
      setUser(data); setEditMode(false); setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Failed to update profile')
    } finally { setSaving(false) }
  }

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) await api.post('/auth/logout', { refreshToken })
    } catch {}
    localStorage.clear(); navigate('/login')
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await api.delete('/auth/me'); localStorage.clear(); navigate('/login')
    } catch {
      setDeleting(false); setShowDelete(false); setError('Failed to delete account')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!user) return null

  const roleMeta = ROLE_META[user.role] ?? ROLE_META.TESTER

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Success toast */}
        {saveSuccess && (
          <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-600 text-white text-sm rounded-xl shadow-lg">
            <CheckCircle2 size={15} /> Profile updated
          </div>
        )}

        {/* Page error */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl mb-6 text-red-600 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Avatar + name header */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg mb-4 ring-4 ring-white">
            {initials(user.name)}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
          <span className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border font-medium mt-3 ${roleMeta.color} ${roleMeta.bg}`}>
            <Shield size={11} /> {roleMeta.label}
          </span>
        </div>

        {/* Profile card */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-5 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <User size={15} className="text-gray-400" /> Profile Details
            </h2>
            {!editMode ? (
              <button
                onClick={() => { setEditMode(true); setSaveError('') }}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <Pencil size={13} /> Edit
              </button>
            ) : (
              <button
                onClick={() => { setEditMode(false); setNameInput(user.name); setSaveError('') }}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={13} /> Cancel
              </button>
            )}
          </div>

          <div className="px-6 py-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 items-center gap-1.5">
                <User size={12} /> Full Name
              </label>
              {editMode ? (
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-emerald-400 transition"
                />
              ) : (
                <p className="text-sm text-gray-800 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5">{user.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 items-center gap-1.5">
                <Mail size={12} /> Email Address
              </label>
              <p className="text-sm text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
                {user.email}
                <span className="text-[10px] text-gray-400 ml-auto">Read-only</span>
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 items-center gap-1.5">
                <Shield size={12} /> Role
              </label>
              <p className={`text-sm font-semibold bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 ${roleMeta.color}`}>
                {roleMeta.label}
              </p>
            </div>

            {saveError && (
              <p className="flex items-center gap-1.5 text-xs text-red-500">
                <AlertCircle size={12} /> {saveError}
              </p>
            )}

            {editMode && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition shadow-sm"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Save Changes
              </button>
            )}
          </div>
        </div>

        {/* Account Actions */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <KeyRound size={15} className="text-gray-400" /> Account Actions
            </h2>
          </div>
          <div className="px-6 py-5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowLogout(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 text-gray-600 hover:text-gray-800 text-sm font-medium rounded-xl transition"
            >
              <LogOut size={15} /> Sign Out
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 text-sm font-medium rounded-xl transition"
            >
              <Trash2 size={15} /> Delete Account
            </button>
          </div>
        </div>

      </div>

      {showLogout && (
        <ConfirmModal
          title="Sign out?"
          message="You'll be redirected to the login page."
          confirmLabel="Sign Out"
          confirmColor="bg-gray-600 hover:bg-gray-700"
          onConfirm={handleLogout}
          onClose={() => setShowLogout(false)}
        />
      )}

      {showDelete && (
        <ConfirmModal
          title="Delete your account?"
          message="This is permanent and cannot be undone. All your data will be removed."
          confirmLabel={deleting ? 'Deleting…' : 'Yes, Delete'}
          confirmColor="bg-red-600 hover:bg-red-700"
          onConfirm={handleDeleteAccount}
          onClose={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}