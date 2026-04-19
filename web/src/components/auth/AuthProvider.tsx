'use client'

import * as React from 'react'
import { LOCAL_ACCESS_TOKEN } from '@/lib/local-user'
import { useUserStore } from '@/stores'

interface AuthProviderProps {
  userId: string
  email: string
  children: React.ReactNode
}

export function AuthProvider({ userId, email, children }: AuthProviderProps) {
  const setUser = useUserStore((s) => s.setUser)
  const setAccessToken = useUserStore((s) => s.setAccessToken)
  const setAuthLoading = useUserStore((s) => s.setAuthLoading)
  const setOnboarded = useUserStore((s) => s.setOnboarded)
  const initialized = React.useRef(false)

  React.useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    setUser({ id: userId, email })
    setAccessToken(LOCAL_ACCESS_TOKEN)
    setAuthLoading(false)
    setOnboarded(true)
  }, [
    email,
    setAccessToken,
    setAuthLoading,
    setOnboarded,
    setUser,
    userId,
  ])

  return <>{children}</>
}
