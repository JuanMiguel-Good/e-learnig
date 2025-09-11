import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth, AuthState, User } from '../lib/auth'

interface AuthContextType extends AuthState {
  signUp: (userData: any) => Promise<{ user: User | null; error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ user: User | null; error: Error | null }>
  signOut: () => Promise<{ error: Error | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const currentUser = auth.getCurrentUser()
    setUser(currentUser)
    setIsLoading(false)
  }, [])

  const signUp = async (userData: any) => {
    setIsLoading(true)
    const result = await auth.signUp(userData)
    if (result.user) {
      setUser(result.user)
    }
    setIsLoading(false)
    return result
  }

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    const result = await auth.signIn(email, password)
    if (result.user) {
      setUser(result.user)
    }
    setIsLoading(false)
    return result
  }

  const signOut = async () => {
    setIsLoading(true)
    const result = await auth.signOut()
    setUser(null)
    setIsLoading(false)
    return result
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}