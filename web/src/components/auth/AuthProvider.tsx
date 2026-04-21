'use client'

import * as React from 'react'
import { useUserStore } from '@/stores'

interface AuthProviderProps {
  userId: string
  email: string
  children: React.ReactNode
}

export function AuthProvider({ userId, email, children }: AuthProviderProps) {
  const setUser = useUserStore((s) => s.setUser)
  const setAuthLoading = useUserStore((s) => s.setAuthLoading)
  const setOnboarded = useUserStore((s) => s.setOnboarded)
  const initialized = React.useRef(false)

  React.useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    setUser({ id: userId, email })
    setAuthLoading(false)
    setOnboarded(true)
  }, [
    email,
    setAuthLoading,
    setOnboarded,
    setUser,
    userId,
  ])

  return <>{children}</>
}
