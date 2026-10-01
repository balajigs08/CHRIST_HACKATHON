import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { errorMessage } from '../services/api.js'

export default function LoginPage() {
  const {
    loginUser,
    loginAuthority,
    registerUser,
    registerAuthority,
    verifyOTP,
    resendOTP,
    setCurrentView,
    authorityExists,
    authorityStatusLoading,
    checkAuthorityStatus,
  } = useAuth()

  // Active Flow: 'user' | 'authority'
  const [authType, setAuthType] = useState('user')

  // User Sub-mode: 'login' | 'register' | 'verify_otp'
  const [userMode, setUserMode] = useState('login')

  // Authority Sub-mode: 'login' | 'register' (determined by backend status)
  const [authorityMode, setAuthorityMode] = useState(null) // null = loading

  // Form Fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')

  // UI State
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // On mount, check authority status so we know whether to show register or login
  useEffect(() => {
    if (authorityExists === null) {
      checkAuthorityStatus().then((exists) => {
        setAuthorityMode(exists ? 'login' : 'register')
      })
    } else {
      setAuthorityMode(authorityExists ? 'login' : 'register')
    }
  }, [authorityExists]) // eslint-disable-line react-hooks/exhaustive-deps

  // When switching to authority tab, re-check status
  const handleSwitchToAuthority = async () => {
    setAuthType('authority')
    setError('')
    setSuccessMsg('')
    setAuthorityMode(null)
    const exists = await checkAuthorityStatus()
    setAuthorityMode(exists ? 'login' : 'register')
  }

  // -----------------------------------------------------------------------
  // Citizen User Handlers
  // -----------------------------------------------------------------------
  const handleUserLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      await loginUser(email, password)
    } catch (err) {
      const msg = errorMessage(err)
      setError(msg)
      if (msg.toLowerCase().includes('verify') || msg.toLowerCase().includes('otp')) {
        setUserMode('verify_otp')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUserRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      const res = await registerUser(name, email, password)
      setSuccessMsg(res.message || 'Verification code sent to your email.')
      setUserMode('verify_otp')
      setCooldown(res.cooldown_seconds || 60)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      await verifyOTP(email, otp)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setError('')
    try {
      const res = await resendOTP(email)
      setSuccessMsg(res.message || 'Fresh OTP code dispatched to email.')
      setCooldown(res.cooldown_seconds || 60)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // -----------------------------------------------------------------------
  // Authority Handlers
  // -----------------------------------------------------------------------
  const handleAuthorityLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      await loginAuthority(email, password)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleAuthorityRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await registerAuthority(name, email, password, confirmPassword)
      setSuccessMsg(res.message || 'Authority account created. Please log in.')
      setAuthorityMode('login')
      // Clear sensitive fields
      setPassword('')
      setConfirmPassword('')
      setName('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // -----------------------------------------------------------------------
  // Style helpers
  // -----------------------------------------------------------------------
  const inputCls = (accent = 'sky') =>
    `w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-${accent}-500 focus:outline-none focus:ring-2 focus:ring-${accent}-500/20 transition-all`

  const btnPrimary = (from, to, shadow) =>
    `w-full rounded-xl bg-gradient-to-r from-${from} to-${to} py-3 text-sm font-bold text-white shadow-md ${shadow} hover:opacity-90 transition-all disabled:opacity-50`

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8">
      {/* Back Navigation */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentView('landing')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <span>←</span> Back to Public Portal
        </button>
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEM OPERATIONAL
        </div>
      </div>

      {/* Main Login Card */}
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-lg">
        {/* Brand */}
        <div className="text-center mb-6">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl font-black mb-3"
            style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 4px 16px rgba(14,165,233,0.25)' }}
          >
            ⚡
          </div>
          <h1 className="text-xl font-black tracking-wider text-slate-900">CRISIS COMMAND</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-Agent Emergency Response Platform</p>
        </div>

        {/* Auth Type Switcher */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => {
              setAuthType('user')
              setError('')
              setSuccessMsg('')
            }}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all ${
              authType === 'user'
                ? 'bg-white text-sky-700 border border-sky-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>👤</span> Citizen User
          </button>
          <button
            type="button"
            id="btn-authority-tab"
            onClick={handleSwitchToAuthority}
            className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-bold transition-all ${
              authType === 'authority'
                ? 'bg-white text-amber-700 border border-amber-200 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>🛡️</span> Authority
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
            <span className="text-sm">⚠️</span>
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 flex items-start gap-2">
            <span className="text-sm">✓</span>
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* ================================================================= */}
        {/* CITIZEN USER FLOWS                                                 */}
        {/* ================================================================= */}
        {authType === 'user' && (
          <div>
            {/* Sub-tab selector */}
            {userMode !== 'verify_otp' && (
              <div className="flex items-center justify-center gap-6 border-b border-slate-200 pb-3 mb-5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => { setUserMode('login'); setError('') }}
                  className={`pb-1 transition-all ${
                    userMode === 'login'
                      ? 'text-sky-600 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Citizen Login
                </button>
                <button
                  type="button"
                  onClick={() => { setUserMode('register'); setError('') }}
                  className={`pb-1 transition-all ${
                    userMode === 'register'
                      ? 'text-sky-600 border-b-2 border-sky-500'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  Register Account
                </button>
              </div>
            )}

            {/* 1. Citizen Login */}
            {userMode === 'login' && (
              <form onSubmit={handleUserLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
                  <input
                    id="user-login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="citizen@example.com"
                    className={inputCls('sky')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
                  <input
                    id="user-login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={inputCls('sky')}
                  />
                </div>
                <button
                  id="btn-user-login"
                  type="submit"
                  disabled={loading}
                  className={btnPrimary('sky-500', 'blue-600', 'shadow-sky-500/20')}
                >
                  {loading ? 'Authenticating...' : 'Sign In to User Dashboard'}
                </button>
              </form>
            )}

            {/* 2. Citizen Registration */}
            {userMode === 'register' && (
              <form onSubmit={handleUserRegister} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    id="user-register-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className={inputCls('sky')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    id="user-register-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@example.com"
                    className={inputCls('sky')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                  <input
                    id="user-register-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className={inputCls('sky')}
                  />
                </div>
                <div className="text-[11px] text-slate-400 leading-tight">
                  🔒 A secure 6-digit OTP verification code will be sent to your email to activate your account.
                </div>
                <button
                  id="btn-user-register"
                  type="submit"
                  disabled={loading}
                  className={btnPrimary('sky-500', 'blue-600', 'shadow-sky-500/20')}
                >
                  {loading ? 'Creating Account...' : 'Register & Send Verification OTP'}
                </button>
              </form>
            )}

            {/* 3. OTP Verification */}
            {userMode === 'verify_otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-700">
                  Enter the 6-digit verification code sent to <span className="font-bold text-sky-900">{email}</span>.
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">6-Digit Verification Code</label>
                  <input
                    id="user-otp-input"
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="123456"
                    className="w-full text-center tracking-[0.5em] font-mono font-bold text-xl rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sky-700 placeholder-sky-300 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                  />
                </div>
                <button
                  id="btn-verify-otp"
                  type="submit"
                  disabled={loading || otp.length !== 6}
                  className={btnPrimary('emerald-500', 'teal-600', 'shadow-emerald-500/20')}
                >
                  {loading ? 'Verifying...' : 'Verify Email & Enter Dashboard'}
                </button>
                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => setUserMode('login')}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    Back to Login
                  </button>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-sky-600 hover:underline font-semibold"
                  >
                    Resend Code
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* AUTHORITY FLOWS                                                    */}
        {/* ================================================================= */}
        {authType === 'authority' && (
          <div>
            {/* Loading authority status */}
            {(authorityMode === null || authorityStatusLoading) && (
              <div className="py-6 text-center">
                <div className="inline-flex items-center gap-2 text-xs text-slate-500 font-mono">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  Checking authority status...
                </div>
              </div>
            )}

            {/* Authority Login */}
            {authorityMode === 'login' && !authorityStatusLoading && (
              <div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800 mb-4">
                  🛡️ <strong>Command Authority Access</strong> — Authenticate with your registered authority credentials.
                </div>
                <form onSubmit={handleAuthorityLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authority Email</label>
                    <input
                      id="authority-login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="authority@emergency.gov"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Authority Password</label>
                    <input
                      id="authority-login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
                    />
                  </div>
                  <button
                    id="btn-authority-login"
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-red-600 py-3 text-sm font-bold text-white shadow-md shadow-amber-500/20 hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Verifying Authority...' : 'Enter Authority Command Dashboard'}
                  </button>
                </form>
              </div>
            )}

            {/* Authority Registration — only when no authority account exists */}
            {authorityMode === 'register' && !authorityStatusLoading && (
              <div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 mb-4">
                  🏛️ <strong>First-Time Authority Setup</strong> — No authority account is registered yet. Create the system authority account below. This can only be done once.
                </div>
                <form onSubmit={handleAuthorityRegister} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Authority Name</label>
                    <input
                      id="authority-register-name"
                      type="text"
                      required
                      minLength={2}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Regional Emergency Authority"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
                    <input
                      id="authority-register-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="authority@emergency.gov"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password <span className="text-slate-400 font-normal">(min. 8 characters)</span></label>
                    <input
                      id="authority-register-password"
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <input
                      id="authority-register-confirm-password"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all"
                    />
                  </div>
                  <div className="text-[11px] text-slate-400 leading-tight">
                    🔒 Authority password is hashed and stored securely in the database. Plaintext passwords are never stored.
                  </div>
                  <button
                    id="btn-authority-register"
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-red-600 py-3 text-sm font-bold text-white shadow-md shadow-orange-500/20 hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Creating Authority Account...' : 'Create Authority Account'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer note */}
      <div className="mt-4 text-[10px] text-slate-400 text-center max-w-xs">
        Crisis Command — Emergency Response Platform. All access is logged and audited.
      </div>
    </div>
  )
}
