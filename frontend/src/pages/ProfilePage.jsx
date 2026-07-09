import { useState } from 'react'
import { Mail, KeyRound, User } from 'lucide-react'
import { authApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function ProfilePage() {
  const { user, refresh } = useAuth()
  const [email, setEmail] = useState(user?.email || '')
  const [emailSaved, setEmailSaved] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailLoading, setEmailLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const handleEmailSave = async (e) => {
    e.preventDefault()
    setEmailError('')
    setEmailSaved(false)
    setEmailLoading(true)
    try {
      await authApi.updateEmail(email)
      await refresh()
      setEmailSaved(true)
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Speichern fehlgeschlagen')
    } finally {
      setEmailLoading(false)
    }
  }

  const handlePasswordSave = async (e) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSaved(false)
    if (newPassword.length < 8) { setPasswordError('Neues Passwort muss mindestens 8 Zeichen haben'); return }
    setPasswordLoading(true)
    try {
      await authApi.changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setPasswordSaved(true)
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Ändern fehlgeschlagen')
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <User size={20} className="text-indigo-400" />
          Mein Profil
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.role === 'ausbilder' ? 'Ausbilder-Konto' : 'Azubi-Konto'}
        </p>
      </div>

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Mail size={14} className="text-slate-400" />
          E-Mail-Adresse
        </h2>
        <form onSubmit={handleEmailSave} className="space-y-3">
          <input
            type="email" required className="input-field max-w-sm"
            value={email} onChange={e => setEmail(e.target.value)}
          />
          {emailError && <p className="text-sm text-red-400">{emailError}</p>}
          {emailSaved && <p className="text-sm text-green-400">Gespeichert.</p>}
          <button type="submit" disabled={emailLoading} className="btn-primary">
            {emailLoading ? 'Speichern...' : 'E-Mail speichern'}
          </button>
        </form>
      </div>

      <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <KeyRound size={14} className="text-slate-400" />
          Passwort ändern
        </h2>
        <form onSubmit={handlePasswordSave} className="space-y-3 max-w-sm">
          <div>
            <label className="label">Aktuelles Passwort</label>
            <input
              type="password" required className="input-field"
              value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Neues Passwort</label>
            <input
              type="password" required className="input-field"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          {passwordError && <p className="text-sm text-red-400">{passwordError}</p>}
          {passwordSaved && <p className="text-sm text-green-400">Passwort geändert.</p>}
          <button type="submit" disabled={passwordLoading} className="btn-primary">
            {passwordLoading ? 'Speichern...' : 'Passwort ändern'}
          </button>
        </form>
      </div>
    </div>
  )
}
