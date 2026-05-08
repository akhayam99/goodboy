import { useId, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
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
  /** Override which element receives focus when the dialog opens. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
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
  initialFocusRef,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const titleId = title ? `${uid}-title` : undefined;
  const descId = description ? `${uid}-desc` : undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
        const target = initialFocusRef?.current;
        if (target) {
          target.focus();
        } else {
          const first = dialog.querySelector<HTMLElement>(
            'input:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          first?.focus();
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open, initialFocusRef]);

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
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground shadow-xl"
    >
      <div className={cn('flex max-h-[85vh] min-h-0 flex-col', SIZE[size], className)}>
        {title || description || showClose ? (
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border-soft px-6 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              {title ? (
                <h2 id={titleId} className="text-sm font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descId} className="text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
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
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border-soft bg-subtle px-6 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
