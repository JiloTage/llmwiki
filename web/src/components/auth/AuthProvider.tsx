'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { LOCAL_ACCESS_TOKEN } from '@/lib/local-user'
import { useKBStore, useUserStore } from '@/stores'

interface AuthProviderProps {
  userId: string
  email: string
  children: React.ReactNode
}

export function AuthProvider({ userId, email, children }: AuthProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const setUser = useUserStore((s) => s.setUser)
  const setAccessToken = useUserStore((s) => s.setAccessToken)
  const setAuthLoading = useUserStore((s) => s.setAuthLoading)
  const setOnboarded = useUserStore((s) => s.setOnboarded)
  const onboarded = useUserStore((s) => s.onboarded)
  const fetchKBs = useKBStore((s) => s.fetchKBs)
  const initialized = React.useRef(false)

  React.useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    setUser({ id: userId, email })
    setAccessToken(LOCAL_ACCESS_TOKEN)
    setAuthLoading(false)
    fetchKBs()

    apiFetch<{ onboarded: boolean }>('/v1/me', LOCAL_ACCESS_TOKEN)
      .then((me) => {
        setOnboarded(me.onboarded)
        if (!me.onboarded && pathname !== '/onboarding') {
          router.replace('/onboarding')
        }
      })
      .catch(() => {
        const stored = useUserStore.getState().onboarded
        if (stored === null) setOnboarded(true)
      })
  }, [
    email,
    fetchKBs,
    pathname,
    router,
    setAccessToken,
    setAuthLoading,
    setOnboarded,
    setUser,
    userId,
  ])

  React.useEffect(() => {
    if (onboarded === false && pathname !== '/onboarding') {
      router.replace('/onboarding')
    }
  }, [onboarded, pathname, router])

  return <>{children}</>
}
