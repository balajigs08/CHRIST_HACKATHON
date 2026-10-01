import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../services/api.js'

export default function PublicLandingPage() {
  const { user, isAuthenticated, isAuthority, logout, setCurrentView } = useAuth()
  const [healthStatus, setHealthStatus] = useState('checking')

  useEffect(() => {
    api.health()
      .then((res) => {
        setHealthStatus(res.status === 'ok' ? 'operational' : 'degraded')
      })
      .catch(() => setHealthStatus('offline'))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl font-black text-white"
            style={{ background: 'linear-gradient(135deg,#0ea5e9,#6366f1)', boxShadow: '0 2px 12px rgba(14,165,233,0.25)' }}
          >
            ⚡
          </div>
          <div>
            <h1 className="text-base font-black tracking-widest text-slate-900 leading-none">CRISIS COMMAND</h1>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">
              Public Safety & Emergency Operations Platform
            </p>
          </div>
        </div>

        {/* Center Live Badges */}
        <div className="hidden md:flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1.5">
            <span
              className={`h-2 w-2 rounded-full ${
                healthStatus === 'operational'
                  ? 'bg-emerald-500 animate-pulse'
                  : healthStatus === 'degraded'
                  ? 'bg-amber-500'
                  : 'bg-red-500'
              }`}
            />
            <span className="text-slate-600 font-semibold uppercase tracking-wider">
              Network: {healthStatus}
            </span>
          </div>
        </div>

        {/* Right Actions / Login Button */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView(isAuthority ? 'authority_dashboard' : 'user_dashboard')}
                className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 transition-all shadow-sm"
              >
                Go to {isAuthority ? 'Authority Dashboard' : 'User Dashboard'}
              </button>
              <button
                onClick={logout}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                id="nav-login-button"
                onClick={() => setCurrentView('login')}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-sky-500/20 hover:from-sky-400 hover:to-blue-500 transition-all transform hover:-translate-y-0.5"
              >
                <span>🔐</span>
                <span>Login</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main className="flex-1 flex flex-col justify-center items-center px-4 py-16 text-center relative overflow-hidden max-w-5xl mx-auto">
        {/* Alert status tag */}
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-semibold text-sky-700 mb-6">
          <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
          Autonomous Multi-Agent Crisis Response & Fleet Coordination
        </div>

        {/* Main Headline */}
        <h2 className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 max-w-3xl leading-tight mb-6">
          Real-Time Emergency Dispatch & Tactical Resource Allocation
        </h2>

        {/* Subtitle */}
        <p className="text-base md:text-lg text-slate-500 max-w-2xl leading-relaxed mb-10">
          Powered by intelligent multi-agent assessment, mathematical optimization, and human-in-the-loop validation for seamless disaster and emergency response.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md">
          <button
            id="hero-citizen-report-btn"
            onClick={() => {
              if (isAuthenticated && !isAuthority) {
                setCurrentView('user_dashboard')
              } else {
                setCurrentView('login')
              }
            }}
            className="w-full sm:w-auto flex-1 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 text-sm font-black text-white shadow-lg shadow-red-500/20 hover:from-red-400 hover:to-rose-500 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            <span>🚨</span>
            <span>Report Incident (Citizen)</span>
          </button>

          <button
            id="hero-authority-btn"
            onClick={() => {
              if (isAuthenticated && isAuthority) {
                setCurrentView('authority_dashboard')
              } else {
                setCurrentView('login')
              }
            }}
            className="w-full sm:w-auto flex-1 rounded-xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>🛡️</span>
            <span>Command Authority</span>
          </button>
        </div>

        {/* ── Capabilities Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left w-full">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-sky-200 transition-all">
            <div className="text-2xl mb-3">⚡</div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Multi-Agent Assessment</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Rapid incident categorization, automated severity scoring, and resource demand forecasting across ambulances, fire units, and rescue teams.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-sky-200 transition-all">
            <div className="text-2xl mb-3">📐</div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Mathematical Optimization</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              PuLP & CBC mathematical MILP solver matching available fleet resources to incidents based on capability, distance, ETA, and equity fairness.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-sky-200 transition-all">
            <div className="text-2xl mb-3">🛡️</div>
            <h3 className="text-sm font-bold text-slate-800 mb-2">Role-Based Security</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              OTP-verified civilian incident intake with incident report privacy and hardened environment-based authority command access.
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-400 font-mono bg-white">
        CRISIS COMMAND · DOMAIN 4 PUBLIC SAFETY & EMERGENCY RESPONSE · GATEWAYS 2026
      </footer>
    </div>
  )
}
