import type { ComponentProps } from 'react'
import { ScrollFade } from './ScrollFade'

export type ScrollAreaProps = ComponentProps<'div'> & {
  /** class applied to the inner scrolling viewport (where overflow lives) */
  viewportClassName?: string
}

/**
 * Thin alias over {@link ScrollFade}: same import name + props, but the raw
 * `overflow-auto` surface is replaced by a faded-edge scroll region. The
 * outer `className` controls layout/sizing; pass `viewportClassName` to style
 * the scrolling viewport (e.g. to opt into horizontal overflow).
 */
export const ScrollArea = ({ className, viewportClassName, children }: ScrollAreaProps) => {
  return (
    <ScrollFade className={className} viewportClassName={viewportClassName}>
      {children}
    </ScrollFade>
  )
}
