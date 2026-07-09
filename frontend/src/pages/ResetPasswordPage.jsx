import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { authApi } from '../api/client'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Passwort muss mindestens 8 Zeichen haben'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Zurücksetzen fehlgeschlagen')
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
          <h1 className="text-lg font-bold text-white">Neues Passwort</h1>
        </div>
        {done ? (
          <p className="text-sm text-green-400 text-center">Passwort geändert. Du wirst weitergeleitet...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Neues Passwort</label>
              <input
                type="password" required autoFocus className="input-field"
                value={password} onChange={e => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Speichern...' : 'Passwort setzen'}
            </button>
          </form>
        )}
        <Link to="/login" className="block text-center text-xs text-slate-500 hover:text-slate-300 mt-4">
          Zurück zur Anmeldung
        </Link>
      </div>
    </div>
  )
}
