import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, errorMessage } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('landing') // 'landing' | 'login' | 'user_dashboard' | 'authority_dashboard'

  // Authority status (does a DB authority account exist?)
  const [authorityExists, setAuthorityExists] = useState(null) // null = unknown, true/false = known
  const [authorityStatusLoading, setAuthorityStatusLoading] = useState(false)

  // Initialize and restore session from localStorage
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem('crisis_auth_token')
      const storedUser = localStorage.getItem('crisis_auth_user')
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        if (parsedUser.role === 'authority') {
          setCurrentView('authority_dashboard')
        } else {
          setCurrentView('user_dashboard')
        }
      } else {
        setCurrentView('landing')
      }
    } catch (e) {
      console.error('Failed to restore auth session', e)
      localStorage.removeItem('crisis_auth_token')
      localStorage.removeItem('crisis_auth_user')
      setCurrentView('landing')
    } finally {
      setLoading(false)
    }
  }, [])

  // Check authority status from backend
  const checkAuthorityStatus = useCallback(async () => {
    setAuthorityStatusLoading(true)
    try {
      const res = await api.auth.authorityStatus()
      setAuthorityExists(res.authority_exists)
      return res.authority_exists
    } catch (err) {
      console.error('Failed to check authority status', err)
      setAuthorityExists(false)
      return false
    } finally {
      setAuthorityStatusLoading(false)
    }
  }, [])

  // Citizen User Login
  const loginUser = async (email, password) => {
    const res = await api.auth.login({ email, password })
    const userData = {
      id: res.user_id,
      name: res.name,
      email: res.email,
      role: res.role,
      token: res.access_token,
      is_verified: true,
    }
    localStorage.setItem('crisis_auth_token', res.access_token)
    localStorage.setItem('crisis_auth_user', JSON.stringify(userData))
    setUser(userData)
    setCurrentView('user_dashboard')
    return userData
  }

  // Regional Authority Login (DB-backed)
  const loginAuthority = async (email, password) => {
    const res = await api.auth.authorityLogin({ email, password })
    const userData = {
      id: res.user_id,
      name: res.name,
      email: res.email,
      role: res.role,
      token: res.access_token,
      is_verified: true,
    }
    localStorage.setItem('crisis_auth_token', res.access_token)
    localStorage.setItem('crisis_auth_user', JSON.stringify(userData))
    setUser(userData)
    setCurrentView('authority_dashboard')
    return userData
  }

  // Authority Registration (only when no authority exists)
  const registerAuthority = async (name, email, password, confirmPassword) => {
    const res = await api.auth.authorityRegister({
      name,
      email,
      password,
      confirm_password: confirmPassword,
    })
    // After registration, update status so UI switches to login mode
    setAuthorityExists(true)
    return res
  }

  // Citizen Registration
  const registerUser = async (name, email, password) => {
    return await api.auth.register({ name, email, password })
  }

  // OTP Verification
  const verifyOTP = async (email, otp) => {
    const res = await api.auth.verifyOtp({ email, otp })
    if (res.access_token) {
      const userData = {
        id: res.user?.id || 'usr-verified',
        name: res.user?.name || email.split('@')[0],
        email: res.email,
        role: res.role || 'user',
        token: res.access_token,
        is_verified: true,
      }
      localStorage.setItem('crisis_auth_token', res.access_token)
      localStorage.setItem('crisis_auth_user', JSON.stringify(userData))
      setUser(userData)
      setCurrentView('user_dashboard')
      return userData
    }
    return res
  }

  // Resend OTP
  const resendOTP = async (email) => {
    return await api.auth.resendOtp({ email })
  }

  // Logout
  const logout = () => {
    localStorage.removeItem('crisis_auth_token')
    localStorage.removeItem('crisis_auth_user')
    setUser(null)
    setCurrentView('landing')
  }

  // Safe Navigation with Role Enforcement
  const navigateTo = (view) => {
    if (view === 'authority_dashboard') {
      if (!user) {
        setCurrentView('login')
        return
      }
      if (user.role !== 'authority') {
        setCurrentView('user_dashboard')
        return
      }
    }
    if (view === 'user_dashboard') {
      if (!user) {
        setCurrentView('login')
        return
      }
    }
    setCurrentView(view)
  }

  const value = {
    user,
    loading,
    currentView,
    setCurrentView: navigateTo,
    loginUser,
    loginAuthority,
    registerUser,
    registerAuthority,
    verifyOTP,
    resendOTP,
    logout,
    isAuthenticated: !!user,
    isAuthority: user?.role === 'authority',
    isCitizen: user?.role === 'user',
    // Authority status
    authorityExists,
    authorityStatusLoading,
    checkAuthorityStatus,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
