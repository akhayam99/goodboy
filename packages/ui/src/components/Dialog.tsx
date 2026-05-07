import { useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../cn';

export type DialogSize = 'sm' | 'md' | 'lg';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  className?: string;
  showClose?: boolean;
  closeOnBackdrop?: boolean;
}

const SIZE: Record<DialogSize, string> = {
  sm: 'w-[22rem]',
  md: 'w-[28rem]',
  lg: 'w-[36rem]',
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  showClose = true,
  closeOnBackdrop = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdrop) return;
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      className={cn(
        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-0 text-foreground',
        'rounded-lg border border-border bg-background shadow-xl',
        'backdrop:bg-black/50 backdrop:backdrop-blur-[2px]',
        'max-h-[85vh] max-w-[92vw] overflow-hidden',
        'flex flex-col',
        SIZE[size],
        className,
      )}
    >
      {title || description || showClose ? (
        <header className="flex items-start justify-between gap-3 border-b border-border-soft px-5 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {showClose ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="close"
              className="-mr-1 -mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span aria-hidden className="text-base leading-none">
                ×
              </span>
            </button>
          ) : null}
        </header>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 text-sm">
        {children}
      </div>
      {footer ? (
        <footer className="flex items-center justify-end gap-2 border-t border-border-soft bg-subtle px-5 py-3">
          {footer}
        </footer>
      ) : null}
    </dialog>
  );
}
