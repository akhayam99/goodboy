import { useEffect, useRef, useState, type ReactNode } from 'react'

/* Scroll-reveal primitive. `useInView` flips to true the first time the
   element crosses into the viewport, then disconnects. Pairs with the
   `.reveal-group` / `.reveal` CSS in styles.css. Falls back to visible when
   IntersectionObserver is unavailable so content never gets stuck hidden. */
export function useInView<T extends Element = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true)
            io.disconnect()
            break
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, inView }
}

/* Self-contained single-block reveal. Use for one-shot blocks; for multi-part
   layouts drive `useInView` on the section and tag children `.reveal`. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={['reveal-group', inView ? 'is-visible' : ''].filter(Boolean).join(' ')}
    >
      <div
        className={['reveal', className].filter(Boolean).join(' ')}
        style={{ animationDelay: `${delay}ms` }}
      >
        {children}
      </div>
    </div>
  )
}
