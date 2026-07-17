import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LogIn, Lock } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { settingsApi } from '../api/client'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [logoUrl, setLogoUrl] = useState(null)
  const [backgroundUrl, setBackgroundUrl] = useState(null)

  useEffect(() => {
    settingsApi.getAll().then(s => {
      if (s.logo_url) setLogoUrl(s.logo_url)
      if (s.login_background_url) setBackgroundUrl(s.login_background_url)
    }).catch(() => {})
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loggedInUser = await login(email, password)
      const from = location.state?.from?.pathname
      if (loggedInUser.must_change_password) {
        navigate('/change-password', { replace: true })
      } else {
        navigate(from || (loggedInUser.role === 'ausbilder' ? '/admin' : '/portal'), { replace: true })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Anmeldung fehlgeschlagen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="light-theme min-h-screen w-full relative flex items-center justify-center bg-[#0d0f1a] bg-cover bg-center p-4"
      style={backgroundUrl ? { backgroundImage: `url(${backgroundUrl})` } : undefined}
    >
      <div className="absolute top-6 left-6 md:top-10 md:left-10">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-28 md:h-40 w-auto max-w-[360px] object-contain drop-shadow-xl" />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <Lock size={32} className="text-indigo-400" />
          </div>
        )}
      </div>

      <div className="w-full max-w-sm bg-[#141625] border border-[#2a2d4a] rounded-2xl p-8 shadow-2xl">
        <h1 className="text-lg font-bold text-white text-center mb-6">Anmelden</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">E-Mail</label>
            <input
              type="email" required autoFocus className="input-field"
              value={email} onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input
              type="password" required className="input-field"
              value={password} onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
            <LogIn size={14} />
            {loading ? 'Anmelden...' : 'Anmelden'}
          </button>
        </form>
        <Link to="/forgot-password" className="block text-center text-xs text-slate-500 hover:text-slate-300 mt-4">
          Passwort vergessen?
        </Link>
      </div>
    </div>
  )
}
