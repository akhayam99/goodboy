import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ImageLightboxProps {
  readonly src: string;
  readonly alt: string;
  readonly onClose: () => void;
}

/**
 * Full-viewport image preview: backdrop blur, centered image, X / Esc /
 * click-outside to dismiss. Rendered via portal so it escapes any
 * `overflow: hidden` ancestor and stacks above everything.
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`preview ${alt}`}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/70 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        title="close (esc)"
        aria-label="close image preview"
        className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-background/95 text-foreground shadow-lg ring-1 ring-border-soft transition-colors hover:bg-background"
      >
        <X size={18} aria-hidden />
      </button>
      <img
        src={src}
        alt={alt}
        // Stop propagation so clicking the image itself doesn't dismiss.
        // Only the surrounding backdrop closes the preview.
        onClick={(event) => event.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
      />
    </div>,
    document.body,
  );
}
