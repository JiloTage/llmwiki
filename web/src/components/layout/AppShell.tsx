'use client'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen overflow-hidden">
      <main className="h-full overflow-y-auto">{children}</main>
    </div>
  )
}
