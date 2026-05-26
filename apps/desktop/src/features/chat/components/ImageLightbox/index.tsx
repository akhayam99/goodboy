import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  readonly src: string;
  readonly alt: string;
  readonly onClose: () => void;
}

const EXIT_MS = 180;

/**
 * Full-viewport image preview: backdrop blur, centered image, X / Esc /
 * click-outside to dismiss. Rendered via portal so it escapes any
 * `overflow: hidden` ancestor and stacks above everything.
 *
 * Three-phase lifecycle keeps mount and unmount animated:
 *   `enter`  initial paint with hidden classes
 *   `open`   visible classes applied next frame, CSS transitions in
 *   `leave`  hidden classes reapplied, parent's `onClose` fires after
 *            the exit transition so the unmount happens at the end of
 *            the animation, not the start.
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [phase, setPhase] = useState<'enter' | 'open' | 'leave'>('enter');
  const exitTimerRef = useRef<number | null>(null);

  // Two rAFs so the browser commits the initial `enter` classes to a paint
  // before we flip to `open`. A single rAF batches with the initial render
  // on some browsers and skips the transition entirely.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPhase('open'));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const requestClose = useCallback(() => {
    setPhase((prev) => (prev === 'leave' ? prev : 'leave'));
  }, []);

  useEffect(() => {
    if (phase !== 'leave') return;
    exitTimerRef.current = window.setTimeout(onClose, EXIT_MS);
    return () => {
      if (exitTimerRef.current !== null) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, [phase, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [requestClose]);

  const visible = phase === 'open';

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
      <img
        src={src}
        alt={alt}
        // Stop propagation so clicking the image itself doesn't dismiss.
        // Only the surrounding backdrop closes the preview.
        onClick={(event) => event.stopPropagation()}
        className={`max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-all duration-[180ms] ease-out ${
          visible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
      />
    </div>,
    document.body,
  );
}
