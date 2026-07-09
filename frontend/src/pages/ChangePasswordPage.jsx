import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function ChangePasswordPage() {
  const { user, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('Neues Passwort muss mindestens 8 Zeichen haben'); return }
    setLoading(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      const updated = await refresh()
      navigate(updated.role === 'ausbilder' ? '/admin' : '/portal', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Ändern fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f1a] p-4">
      <div className="w-full max-w-sm bg-[#141625] border border-[#2a2d4a] rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <KeyRound size={24} className="text-indigo-400" />
          </div>
          <h1 className="text-lg font-bold text-white">Passwort ändern</h1>
          {user?.must_change_password && (
            <p className="text-xs text-amber-400 text-center">Bitte lege jetzt dein eigenes Passwort fest.</p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!user?.must_change_password && (
            <div>
              <label className="label">Aktuelles Passwort</label>
              <input
                type="password" required className="input-field"
                value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="label">Neues Passwort</label>
            <input
              type="password" required autoFocus className="input-field"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            {loading ? 'Speichern...' : 'Passwort setzen'}
          </button>
        </form>
        <button onClick={logout} className="block w-full text-center text-xs text-slate-500 hover:text-slate-300 mt-4">
          Abmelden
        </button>
      </div>
    </div>
  )
}
