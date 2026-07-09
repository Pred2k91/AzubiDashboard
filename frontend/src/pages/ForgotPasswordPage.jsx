import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { authApi } from '../api/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await authApi.forgotPassword(email)
    } finally {
      setSent(true)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0f1a] p-4">
      <div className="w-full max-w-sm bg-[#141625] border border-[#2a2d4a] rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <Mail size={24} className="text-indigo-400" />
          </div>
          <h1 className="text-lg font-bold text-white">Passwort vergessen</h1>
        </div>
        {sent ? (
          <p className="text-sm text-slate-400 text-center">
            Falls ein Konto mit dieser E-Mail existiert, wurde ein Link zum Zurücksetzen versendet.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-Mail</label>
              <input
                type="email" required autoFocus className="input-field"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Senden...' : 'Link anfordern'}
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
