import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../cn'

const FADE_FROM = {
  background: 'from-background',
  subtle: 'from-subtle',
  muted: 'from-muted',
} as const

export type ScrollFadeProps = {
  readonly children: ReactNode
  readonly className?: string
  readonly viewportClassName?: string
  readonly fadeFrom?: keyof typeof FADE_FROM
  readonly fadeSize?: number | string
  readonly orientation?: 'vertical' | 'horizontal'
}

export const ScrollFade = ({
  children,
  className,
  viewportClassName,
  fadeFrom = 'background',
  fadeSize = 'h-8',
  orientation = 'vertical',
}: ScrollFadeProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ start: false, end: false })
  const horizontal = orientation === 'horizontal'

  const sync = useCallback(() => {
    const el = ref.current
    if (!el) {
      return
    }
    const start = horizontal ? el.scrollLeft > 1 : el.scrollTop > 1
    const end = horizontal
      ? el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      : el.scrollTop + el.clientHeight < el.scrollHeight - 1
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }))
  }, [horizontal])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) {
      return
    }
    sync()
    const resize = new ResizeObserver(sync)
    resize.observe(el)
    const mutate = new MutationObserver(sync)
    mutate.observe(el, { childList: true, subtree: true })
    return () => {
      resize.disconnect()
      mutate.disconnect()
    }
  }, [sync])

  const from = FADE_FROM[fadeFrom]
  const sizeClass = typeof fadeSize === 'string' ? fadeSize : undefined
  const sizeStyle =
    typeof fadeSize === 'number'
      ? horizontal
        ? { width: fadeSize }
        : { height: fadeSize }
      : undefined

  return (
    <div className={cn('relative min-h-0', className)}>
      <div
        ref={ref}
        onScroll={sync}
        className={cn(
          horizontal
            ? 'h-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          viewportClassName,
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        style={sizeStyle}
        className={cn(
          'pointer-events-none absolute to-transparent motion-safe:transition-opacity duration-200',
          horizontal ? 'inset-y-0 left-0 bg-gradient-to-r' : 'inset-x-0 top-0 bg-gradient-to-b',
          sizeClass,
          from,
          edges.start ? 'opacity-100' : 'opacity-0',
        )}
      />
      <div
        aria-hidden
        style={sizeStyle}
        className={cn(
          'pointer-events-none absolute to-transparent motion-safe:transition-opacity duration-200',
          horizontal ? 'inset-y-0 right-0 bg-gradient-to-l' : 'inset-x-0 bottom-0 bg-gradient-to-t',
          sizeClass,
          from,
          edges.end ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}
