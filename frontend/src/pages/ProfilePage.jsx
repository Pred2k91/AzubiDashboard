import { useState, useEffect, useRef } from 'react'
import { Mail, KeyRound, User, Camera, Bell, ShieldCheck, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { authApi, meApi, pushApi, twoFactorApi } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { isPushSupported, subscribeToPush } from '../utils/push'
import { isPwaInstallAvailable, onPwaInstallAvailabilityChange, promptPwaInstall } from '../utils/pwaInstall'

const EMPTY_FORM = {
  salutation: '', first_name: '', last_name: '',
  phone: '', mobile_phone: '', street: '', postal_code: '', city: '',
  about_me: '', public_note: '',
}

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

  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [twoFaSetupStep, setTwoFaSetupStep] = useState(null) // null | 'qr' | 'backup-codes'
  const [twoFaData, setTwoFaData] = useState(null)
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaBackupCodes, setTwoFaBackupCodes] = useState([])
  const [twoFaError, setTwoFaError] = useState('')
  const [twoFaLoading, setTwoFaLoading] = useState(false)

  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [pushError, setPushError] = useState('')
  const [pushTestLoading, setPushTestLoading] = useState(false)
  const [pushTestResult, setPushTestResult] = useState('')

  const [pwaInstallAvailable, setPwaInstallAvailable] = useState(isPwaInstallAvailable())

  const loadProfile = () => meApi.getFullProfile().then(p => {
    setProfile(p)
    setForm({
      salutation: p.salutation || '', first_name: p.first_name || '', last_name: p.last_name || '',
      phone: p.phone || '', mobile_phone: p.mobile_phone || '',
      street: p.street || '', postal_code: p.postal_code || '', city: p.city || '',
      about_me: p.about_me || '', public_note: p.public_note || '',
    })
  }).catch(() => {})

  useEffect(() => { loadProfile() }, [])

  useEffect(() => {
    const supported = isPushSupported()
    setPushSupported(supported)
    if (!supported) return
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setPushSubscribed(!!sub))
      .catch(() => {})
  }, [])

  useEffect(() => onPwaInstallAvailabilityChange(setPwaInstallAvailable), [])

  const handleInstallApp = async () => {
    const outcome = await promptPwaInstall()
    if (outcome === 'accepted') setPwaInstallAvailable(false)
  }

  const handlePushToggle = async () => {
    setPushError('')
    setPushLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      if (pushSubscribed) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await pushApi.unsubscribe(sub.endpoint)
          await sub.unsubscribe()
        }
        setPushSubscribed(false)
      } else {
        await subscribeToPush()
        setPushSubscribed(true)
      }
    } catch (err) {
      setPushError(err.message || 'Fehler beim Aktivieren der Benachrichtigungen')
    } finally {
      setPushLoading(false)
    }
  }

  const handlePushTest = async () => {
    setPushTestResult('')
    setPushTestLoading(true)
    try {
      await pushApi.sendTest()
      setPushTestResult('Test-Benachrichtigung gesendet — sollte gleich ankommen.')
    } catch (err) {
      setPushTestResult(err.response?.data?.error || 'Test fehlgeschlagen')
    } finally {
      setPushTestLoading(false)
    }
  }

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

  const handleTwoFaSetupStart = async () => {
    setTwoFaError('')
    setTwoFaLoading(true)
    try {
      const data = await twoFactorApi.setup()
      setTwoFaData(data)
      setTwoFaSetupStep('qr')
    } catch (err) {
      setTwoFaError(err.response?.data?.error || 'Einrichtung fehlgeschlagen')
    } finally {
      setTwoFaLoading(false)
    }
  }

  const handleTwoFaConfirm = async (e) => {
    e.preventDefault()
    setTwoFaError('')
    setTwoFaLoading(true)
    try {
      const { backup_codes } = await twoFactorApi.confirm(twoFaCode)
      setTwoFaBackupCodes(backup_codes)
      setTwoFaSetupStep('backup-codes')
      setTwoFaCode('')
      await refresh()
    } catch (err) {
      setTwoFaError(err.response?.data?.error || 'Code falsch')
    } finally {
      setTwoFaLoading(false)
    }
  }

  const handleTwoFaCancel = () => {
    setTwoFaSetupStep(null)
    setTwoFaData(null)
    setTwoFaCode('')
    setTwoFaError('')
  }

  const handleTwoFaFinish = () => {
    setTwoFaSetupStep(null)
    setTwoFaData(null)
    setTwoFaBackupCodes([])
  }

  const handleTwoFaDisable = async () => {
    if (!window.confirm('Zwei-Faktor-Authentifizierung wirklich deaktivieren?')) return
    setTwoFaError('')
    setTwoFaLoading(true)
    try {
      await twoFactorApi.disable()
      await refresh()
    } catch (err) {
      setTwoFaError(err.response?.data?.error || 'Deaktivieren fehlgeschlagen')
    } finally {
      setTwoFaLoading(false)
    }
  }

  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileError('')
    setProfileSaved(false)
    setProfileLoading(true)
    try {
      await meApi.updateFullProfile(form)
      await loadProfile()
      setProfileSaved(true)
    } catch (err) {
      setProfileError(err.response?.data?.error || 'Speichern fehlgeschlagen')
    } finally {
      setProfileLoading(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      await meApi.uploadAvatar(file)
      await Promise.all([loadProfile(), refresh()])
    } catch (_) {
      // Avatar-Upload ist nicht kritisch fürs restliche Profil -- kein Blocking-Fehlerzustand nötig
    } finally {
      setAvatarUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (!profile) {
    return <div className="p-6 text-slate-500 text-sm">Lädt...</div>
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <User size={20} className="text-indigo-400" />
          Mein Profil
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {user?.role === 'ausbilder' ? 'Ausbilder-Konto' : 'Azubi-Konto'}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar: Avatar + Name, wie im Referenz-Screenshot links */}
        <div className="lg:w-56 shrink-0">
          <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 text-center">
            <div className="relative inline-block">
              <div className="w-20 h-20 rounded-full bg-purple-600/20 text-purple-300 flex items-center justify-center text-2xl font-bold overflow-hidden mx-auto">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (profile.display_name || profile.email).charAt(0).toUpperCase()
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                title="Foto ändern"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                <Camera size={12} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div className="mt-3 text-sm font-semibold text-white truncate">{profile.display_name || 'Noch kein Name hinterlegt'}</div>
            <div className="text-xs text-slate-500 truncate">{profile.email}</div>
            <span className="badge bg-indigo-600/10 text-indigo-300 border border-indigo-500/20 mt-2 inline-flex">
              {user?.role === 'ausbilder' ? 'Ausbilder:in' : 'Azubi'}
            </span>
          </div>
        </div>

        {/* 3 Spalten: Persönliche/Kontaktdaten, Über mich/E-Mail, Benachrichtigungen/Sicherheit.
            Bewusst kein <form>-Element hier -- die Kontaktkarten weiter unten (E-Mail/Passwort) haben
            eigene Speichern-Aktionen und dürften sonst nicht verschachtelt sein (kein form-Nesting in HTML). */}
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          <div className="space-y-4">
            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">Persönliche Daten</h2>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Anrede</label>
                  <select
                    className="input-field"
                    value={form.salutation}
                    onChange={e => setForm(f => ({ ...f, salutation: e.target.value }))}
                  >
                    <option value="">—</option>
                    <option value="Herr">Herr</option>
                    <option value="Frau">Frau</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">Name</label>
                  {profile.is_azubi_linked ? (
                    <div className="input-field bg-[#0d0f1a]/50 text-slate-400">{profile.display_name}</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="input-field" placeholder="Vorname"
                        value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                      />
                      <input
                        className="input-field" placeholder="Nachname"
                        value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </div>
              {profile.is_azubi_linked && (
                <p className="text-xs text-slate-600">Name und Geburtsdatum werden über die Azubi-Stammdaten verwaltet.</p>
              )}
              <div>
                <label className="label">Geburtsdatum</label>
                <div className="input-field bg-[#0d0f1a]/50 text-slate-400">
                  {profile.display_birthday ? format(parseISO(profile.display_birthday), 'dd.MM.yyyy') : '—'}
                </div>
              </div>
            </div>

            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">Kontaktdaten</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Telefon</label>
                  <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Mobiltelefon</label>
                  <input className="input-field" value={form.mobile_phone} onChange={e => setForm(f => ({ ...f, mobile_phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="label">Straße</label>
                  <input className="input-field" value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} />
                </div>
                <div>
                  <label className="label">PLZ</label>
                  <input className="input-field" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Ort</label>
                <input className="input-field" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white">Weitere Informationen</h2>
              <div>
                <label className="label">Über mich</label>
                <textarea className="input-field resize-none" rows={3} value={form.about_me} onChange={e => setForm(f => ({ ...f, about_me: e.target.value }))} />
              </div>
              <div>
                <label className="label">Öffentlicher Text</label>
                <textarea className="input-field resize-none" rows={2} value={form.public_note} onChange={e => setForm(f => ({ ...f, public_note: e.target.value }))} />
              </div>
              {profileError && <p className="text-sm text-red-400">{profileError}</p>}
              {profileSaved && <p className="text-sm text-green-400">Gespeichert.</p>}
              <button type="button" onClick={handleProfileSave} disabled={profileLoading} className="btn-primary">
                {profileLoading ? 'Speichern...' : 'Profil speichern'}
              </button>
            </div>

            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Mail size={14} className="text-slate-400" />
                E-Mail-Adresse
              </h2>
              <div className="space-y-3">
                <input
                  type="email" required className="input-field max-w-sm"
                  value={email} onChange={e => setEmail(e.target.value)}
                />
                {emailError && <p className="text-sm text-red-400">{emailError}</p>}
                {emailSaved && <p className="text-sm text-green-400">Gespeichert.</p>}
                <button type="button" onClick={handleEmailSave} disabled={emailLoading} className="btn-primary">
                  {emailLoading ? 'Speichern...' : 'E-Mail speichern'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {pwaInstallAvailable && (
              <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Download size={14} className="text-slate-400" />
                  Als App installieren
                </h2>
                <p className="text-xs text-slate-500">
                  Installiert HERcademy als eigene App auf diesem Gerät -- eigenes Symbol auf dem
                  Startbildschirm, kein Browser-Rahmen, und Push-Benachrichtigungen zeigen dann
                  nur noch unser Icon statt zusätzlich das des Browsers.
                </p>
                <button type="button" onClick={handleInstallApp} className="btn-primary">
                  <Download size={14} />
                  App installieren
                </button>
              </div>
            )}

            {pushSupported && (
              <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Bell size={14} className="text-slate-400" />
                  Push-Benachrichtigungen
                </h2>
                <p className="text-xs text-slate-500">
                  Erhalte Benachrichtigungen auf diesem Gerät (z.B. bei überfälligem Berichtsheft). Auf dem iPhone zuerst über "Teilen" → "Zum Home-Bildschirm" hinzufügen, sonst funktioniert das nicht.
                </p>
                {pushError && <p className="text-sm text-red-400">{pushError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handlePushToggle} disabled={pushLoading} className={pushSubscribed ? 'btn-secondary' : 'btn-primary'}>
                    {pushLoading ? '...' : pushSubscribed ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren'}
                  </button>
                  {pushSubscribed && (
                    <button type="button" onClick={handlePushTest} disabled={pushTestLoading} className="btn-secondary">
                      {pushTestLoading ? '...' : 'Test-Push senden'}
                    </button>
                  )}
                </div>
                {pushTestResult && <p className="text-sm text-slate-400">{pushTestResult}</p>}
              </div>
            )}

            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <KeyRound size={14} className="text-slate-400" />
                Passwort ändern
              </h2>
              <div className="space-y-3">
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
                <button type="button" onClick={handlePasswordSave} disabled={passwordLoading} className="btn-primary">
                  {passwordLoading ? 'Speichern...' : 'Passwort ändern'}
                </button>
              </div>
            </div>

            <div className="bg-[#141625] rounded-xl border border-[#2a2d4a] p-5 space-y-4">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck size={14} className="text-slate-400" />
                Zwei-Faktor-Authentifizierung
              </h2>

              {twoFaSetupStep === 'qr' && twoFaData ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    QR-Code mit einer Authenticator-App scannen (z.B. Microsoft Authenticator, Google Authenticator)
                    und den 6-stelligen Code zur Bestätigung eingeben.
                  </p>
                  <img src={twoFaData.qr_code_data_url} alt="QR-Code" className="rounded-lg border border-[#2a2d4a] bg-white p-2 w-40 h-40" />
                  <div>
                    <label className="label">Secret (falls Scannen nicht möglich)</label>
                    <div className="input-field font-mono text-xs break-all">{twoFaData.secret}</div>
                  </div>
                  <form onSubmit={handleTwoFaConfirm} className="space-y-3">
                    <div>
                      <label className="label">Bestätigungscode</label>
                      <input
                        type="text" inputMode="numeric" required autoFocus className="input-field max-w-[160px] text-center tracking-widest"
                        value={twoFaCode} onChange={e => setTwoFaCode(e.target.value)}
                      />
                    </div>
                    {twoFaError && <p className="text-sm text-red-400">{twoFaError}</p>}
                    <div className="flex gap-2">
                      <button type="submit" disabled={twoFaLoading} className="btn-primary">
                        {twoFaLoading ? 'Prüfe...' : 'Aktivieren'}
                      </button>
                      <button type="button" onClick={handleTwoFaCancel} className="btn-secondary">
                        Abbrechen
                      </button>
                    </div>
                  </form>
                </div>
              ) : twoFaSetupStep === 'backup-codes' ? (
                <div className="space-y-3">
                  <p className="text-sm text-green-400">Aktiviert.</p>
                  <p className="text-xs text-slate-500">
                    Backup-Codes für den Fall, dass du dein Gerät verlierst -- jeder Code funktioniert einmalig.
                    Jetzt speichern, sie werden nur dieses eine Mal angezeigt.
                  </p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs bg-[#0d0f1a] border border-[#2a2d4a] rounded-lg p-3">
                    {twoFaBackupCodes.map(code => <div key={code}>{code}</div>)}
                  </div>
                  <button type="button" onClick={handleTwoFaFinish} className="btn-primary">
                    Ich habe die Codes gespeichert
                  </button>
                </div>
              ) : user?.totp_enabled ? (
                <div className="space-y-3">
                  <p className="text-sm text-green-400">Aktiviert.</p>
                  {twoFaError && <p className="text-sm text-red-400">{twoFaError}</p>}
                  <button type="button" onClick={handleTwoFaDisable} disabled={twoFaLoading} className="btn-secondary">
                    {twoFaLoading ? '...' : 'Deaktivieren'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Freiwillig -- schützt dein Konto zusätzlich mit einem Code aus einer Authenticator-App
                    (z.B. Microsoft Authenticator, Google Authenticator) beim Anmelden.
                  </p>
                  {twoFaError && <p className="text-sm text-red-400">{twoFaError}</p>}
                  <button type="button" onClick={handleTwoFaSetupStart} disabled={twoFaLoading} className="btn-primary">
                    {twoFaLoading ? 'Lädt...' : '2FA einrichten'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
