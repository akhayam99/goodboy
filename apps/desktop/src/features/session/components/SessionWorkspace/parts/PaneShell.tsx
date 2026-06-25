import type { ReactNode } from 'react'
import { cn, ScrollFade } from '@goodboy/ui'

type PaneShellProps = {
  readonly title: string
  readonly description?: string
  readonly actions?: ReactNode
  readonly width?: '2xl' | '3xl'
  readonly children: ReactNode
}

const WIDTH: Record<'2xl' | '3xl', string> = {
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
}

export const PaneShell = ({
  title,
  description,
  actions,
  width = '2xl',
  children,
}: PaneShellProps) => (
  <ScrollFade className="h-full" viewportClassName="px-6 py-5" fadeSize={24}>
    <div className={cn('mx-auto flex flex-col gap-5 motion-safe:animate-studio-in', WIDTH[width])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold leading-snug text-foreground">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  </ScrollFade>
)
