import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'
import { cn } from '@goodboy/ui'

export type SegmentedOption<T extends string> = {
  readonly value: T
  readonly label: string
  readonly icon: LucideIcon
  readonly color?: string
  readonly disabled?: boolean
  readonly badge?: string
  readonly connected?: boolean
}

type Props<T extends string> = {
  readonly options: ReadonlyArray<SegmentedOption<T>>
  readonly value: T
  readonly onChange: (value: T) => void
  readonly ariaLabel: string
}

export const Segmented = <T extends string>({ options, value, onChange, ariaLabel }: Props<T>) => {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="grid w-full gap-1.5 rounded-lg border border-border-soft/60 bg-subtle/30 p-1.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            style={active && opt.color ? { color: opt.color, borderColor: opt.color } : undefined}
            className={cn(
              'group relative flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold motion-safe:transition-all',
              active
                ? 'border-transparent bg-background shadow-sm'
                : 'border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
              opt.disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent',
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-md motion-safe:transition-colors"
              style={
                active && opt.color
                  ? { backgroundColor: `color-mix(in oklch, ${opt.color} 16%, transparent)` }
                  : undefined
              }
            >
              <Icon size={15} aria-hidden />
            </span>
            <span className="truncate">{opt.label}</span>
            {opt.badge ? (
              <span className="rounded bg-foreground/10 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wide text-muted-foreground">
                {opt.badge}
              </span>
            ) : null}
            {opt.connected ? <Check size={13} aria-hidden className="text-success" /> : null}
          </button>
        )
      })}
    </div>
  )
}
