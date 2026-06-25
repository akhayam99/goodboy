import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type Props = {
  readonly src: string
  readonly alt: string
  readonly onClose: () => void
  readonly media?: 'image' | 'pdf'
}

const EXIT_MS = 180

export const ImageLightbox = ({ src, alt, onClose, media = 'image' }: Props) => {
  const [phase, setPhase] = useState<'enter' | 'open' | 'leave'>('enter')
  const exitTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('open'))
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const requestClose = useCallback(() => {
    setPhase((prev) => (prev === 'leave' ? prev : 'leave'))
  }, [])

  useEffect(() => {
    if (phase !== 'leave') {
      return
    }
    exitTimerRef.current = window.setTimeout(onClose, EXIT_MS)
    return () => {
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [phase, onClose])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose()
      }
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [requestClose])

  const visible = phase === 'open'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`preview ${alt}`}
      onClick={requestClose}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-foreground/70 p-8 backdrop-blur-sm transition-opacity duration-[180ms] ease-out ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <button
        type="button"
        onClick={requestClose}
        title="close (esc)"
        aria-label="close image preview"
        className={`absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-lg ring-1 ring-border-soft transition-all duration-[180ms] ease-out hover:bg-background ${
          visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        }`}
      >
        <X size={18} aria-hidden />
      </button>
      {media === 'pdf' ? (
        <iframe
          src={src}
          title={alt}
          onClick={(event) => event.stopPropagation()}
          className={`h-full w-full max-w-3xl rounded-lg bg-white shadow-2xl transition-all duration-[180ms] ease-out ${
            visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          onClick={(event) => event.stopPropagation()}
          className={`max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-all duration-[180ms] ease-out ${
            visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        />
      )}
    </div>,
    document.body,
  )
}
