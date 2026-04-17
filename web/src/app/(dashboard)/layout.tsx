import { AuthProvider } from '@/components/auth/AuthProvider'
import { AppShell } from '@/components/layout/AppShell'
import { LOCAL_USER_EMAIL, LOCAL_USER_ID } from '@/lib/local-user'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider userId={LOCAL_USER_ID} email={LOCAL_USER_EMAIL}>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  )
}
