import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import PublicLandingPage from './pages/PublicLandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import CitizenDashboard from './pages/CitizenDashboard.jsx'
import Dashboard from './pages/Dashboard.jsx'

function MainRouter() {
  const { currentView, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sky-600 font-mono text-sm">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-sky-500 animate-ping" />
          <span className="text-slate-700">INITIALIZING CRISIS COMMAND...</span>
        </div>
      </div>
    )
  }

  // 1. Public Landing Page
  if (currentView === 'landing') {
    return <PublicLandingPage />
  }

  // 2. Dedicated Login & Verification Page
  if (currentView === 'login') {
    return <LoginPage />
  }

  // 3. Protected Citizen User Dashboard (Requires authenticated user)
  if (currentView === 'user_dashboard') {
    if (!user) {
      return <LoginPage />
    }
    return <CitizenDashboard />
  }

  // 4. Protected Regional Authority Dashboard (Requires authority role)
  if (currentView === 'authority_dashboard') {
    if (!user || user.role !== 'authority') {
      return <LoginPage />
    }
    return <Dashboard />
  }

  return <PublicLandingPage />
}

export default function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  )
}
