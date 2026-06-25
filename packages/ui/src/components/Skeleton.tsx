import type { CSSProperties } from 'react'
import { cn } from '../cn'

type SkeletonProps = {
  className?: string
  style?: CSSProperties
}

export const Skeleton = ({ className, style }: SkeletonProps) => {
  return (
    <div
      className={cn('motion-safe:animate-pulse rounded bg-muted', className)}
      style={style}
      aria-hidden
    />
  )
}

type SkeletonRowProps = {
  className?: string
}

export const SkeletonRow = ({ className }: SkeletonRowProps) => {
  return (
    <div className={cn('flex items-center gap-4', className)} role="status" aria-label="Loading">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-1/3 rounded" />
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>
    </div>
  )
}

type SkeletonCardProps = {
  className?: string
}

export const SkeletonCard = ({ className }: SkeletonCardProps) => {
  return (
    <div className={cn('flex flex-col gap-4', className)} role="status" aria-label="Loading">
      <Skeleton className="aspect-video w-full rounded-lg" />
      <Skeleton className="h-4 w-1/2 rounded" />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

type SkeletonTextProps = {
  className?: string
  lines?: number
}

export const SkeletonText = ({ className, lines = 3 }: SkeletonTextProps) => {
  return (
    <div className={cn('flex flex-col gap-2', className)} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3 rounded', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}
