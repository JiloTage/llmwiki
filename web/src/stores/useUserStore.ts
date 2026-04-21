import { create } from 'zustand'

type User = {
  id: string
  email: string
}

type UserState = {
  user: User | null
  authLoading: boolean
  onboarded: boolean | null
  setUser: (user: User | null) => void
  setAuthLoading: (loading: boolean) => void
  setOnboarded: (onboarded: boolean) => void
  signOut: () => void
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  authLoading: true,
  onboarded: null,
  setUser: (user) => set({ user }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setOnboarded: (onboarded) => set({ onboarded }),
  signOut: () => set({ user: null, authLoading: false, onboarded: null }),
}))
