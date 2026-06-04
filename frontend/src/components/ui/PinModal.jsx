import { useState, useEffect, useRef } from 'react'
import { Lock, X } from 'lucide-react'

export default function PinModal({ open, onClose, onSuccess }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef()

  useEffect(() => {
    if (open) {
      setPin('')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = async () => {
    const res = await fetch('/api/settings')
    const settings = await res.json()
    const stored = settings.admin_pin || ''

    if (!stored) {
      // Kein PIN gesetzt → direkt rein
      onSuccess()
      return
    }

    if (pin === stored) {
      onSuccess()
    } else {
      setError('Falscher PIN')
      setShake(true)
      setPin('')
      setTimeout(() => setShake(false), 500)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') handleSubmit()
    if (e.key === 'Escape') onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative bg-[#141625] border border-[#2a2d4a] rounded-2xl p-8 w-80 shadow-2xl ${shake ? 'animate-shake' : ''}`}
        style={shake ? { animation: 'shake 0.4s ease' } : {}}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-[#2a2d4a]">
          <X size={14} />
        </button>

        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
            <Lock size={24} className="text-indigo-400" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">Admin-Bereich</h2>
            <p className="text-sm text-slate-500 mt-1">PIN eingeben</p>
          </div>

          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            className="input-field text-center text-2xl tracking-[0.5em] font-bold w-full"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            onKeyDown={handleKey}
            placeholder="••••"
            maxLength={8}
          />

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <button className="btn-primary w-full justify-center" onClick={handleSubmit}>
            Bestätigen
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  )
}
