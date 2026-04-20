'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type BreadcrumbItem = {
  label: string
  href?: string
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[]
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1

          return (
            <li key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1.5">
              {index > 0 ? <ChevronRight className="size-3 shrink-0 opacity-60" /> : null}
              {item.href && !isCurrent ? (
                <Link
                  href={item.href}
                  className="truncate transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={cn('truncate', isCurrent && 'text-foreground')}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
