import { cn } from '../cn'

export type DividerProps = {
  readonly className?: string
  readonly orientation?: 'horizontal' | 'vertical'
}

export const Divider = ({ className, orientation = 'horizontal' }: DividerProps) => {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === 'horizontal'
          ? 'h-px w-full bg-gradient-to-r from-transparent via-border-soft to-transparent'
          : 'w-px self-stretch bg-gradient-to-b from-transparent via-border-soft to-transparent',
        className,
      )}
    />
  )
}
