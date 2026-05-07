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
  sm: 'w-[24rem]',
  md: 'w-[32rem]',
  lg: 'w-[44rem]',
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
    if (open) {
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const onBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={cn(
        'm-0 h-screen max-h-none w-screen max-w-none border-0 bg-transparent p-0',
        'backdrop:bg-black/50 backdrop:backdrop-blur-[2px]',
      )}
    >
      <div className="flex h-full w-full items-center justify-center p-6" onClick={onBackdropClick}>
        <div
          className={cn(
            'flex max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-xl',
            SIZE[size],
            className,
          )}
          role="document"
        >
          {title || description || showClose ? (
            <header className="flex items-start justify-between gap-4 border-b border-border-soft px-6 py-4">
              <div className="flex min-w-0 flex-col gap-1">
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
                  className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span aria-hidden className="text-base leading-none">
                    ×
                  </span>
                </button>
              ) : null}
            </header>
          ) : null}
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5 text-sm">
            {children}
          </div>
          {footer ? (
            <footer className="flex items-center justify-end gap-2 border-t border-border-soft bg-subtle px-6 py-3">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
