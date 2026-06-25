import type { ComponentProps } from 'react'
import { cn } from '../cn'

export type KbdPillProps = ComponentProps<'kbd'>

export const KbdPill = ({ className, ...rest }: KbdPillProps) => {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-xs text-muted-foreground',
        className,
      )}
      {...rest}
    />
  )
}
