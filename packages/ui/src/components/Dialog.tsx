import { useId, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { cn } from '../cn';
import { Divider } from './Divider';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export type DialogProps = {
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
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  fullScreenOnSmall?: boolean;
  fixedHeightClass?: string;
  bodyClassName?: string;
  headerBordered?: boolean;
  panel?: ReactNode;
  panelWidthClass?: string;
  panelClassName?: string;
};

const SIZE: Record<DialogSize, string> = {
  sm: 'w-[24rem]',
  md: 'w-[32rem]',
  lg: 'w-[44rem]',
  xl: 'w-[56rem]',
  '2xl': 'w-[64rem]',
};

// Per-size baseline min-height. Without this the dialog collapses to the
// height of its content, which looks thin for small forms (add workspace,
// new session). Caps at the per-size sweet spot, large dialogs already
// need more room. Skipped when fixedHeightClass is set (caller knows best).
const MIN_HEIGHT: Record<DialogSize, string> = {
  sm: 'min-h-[16rem]',
  md: 'min-h-[24rem]',
  lg: 'min-h-[28rem]',
  xl: 'min-h-[32rem]',
  '2xl': 'min-h-[34rem]',
};

const SMALL_VIEWPORT = 'max-md:w-screen max-md:h-screen max-md:max-h-screen max-md:max-w-none';

export const Dialog = ({
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
  fullScreenOnSmall = false,
  fixedHeightClass,
  bodyClassName,
  headerBordered = true,
  panel,
  panelWidthClass = 'w-48',
  panelClassName,
}: DialogProps) => {
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  const titleId = title ? `${uid}-title` : undefined;
  const descId = description ? `${uid}-desc` : undefined;

  // Latest-onClose ref so the showModal effect can stay keyed on `open` alone
  // instead of refiring whenever the parent re-renders with a fresh handler.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Suppress close-event-driven onClose when we ourselves called dialog.close()
  // (cleanup or open→false transition). React 19 strict mode double-invokes
  // effects, so a "mount when open" parent would otherwise: setup → showModal,
  // cleanup → dialog.close() queues a close event, resetup → showModal again,
  // then the deferred close event fires onClose against the new listener and
  // the parent unmounts the dialog for real. The user sees nothing happen.
  const programmaticCloseRef = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const handleClose = () => {
      if (programmaticCloseRef.current) {
        programmaticCloseRef.current = false;
        return;
      }
      onCloseRef.current();
    };
    dialog.addEventListener('close', handleClose);

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
      programmaticCloseRef.current = true;
      dialog.close();
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      if (dialog.open) {
        programmaticCloseRef.current = true;
        dialog.close();
      }
    };
  }, [open, initialFocusRef]);

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (!closeOnBackdrop) return;
    if (event.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.stopPropagation();
      }}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-background p-0 text-foreground shadow-xl',
        fullScreenOnSmall &&
          'max-md:m-0 max-md:h-screen max-md:max-h-none max-md:w-screen max-md:max-w-none max-md:rounded-none max-md:border-0 max-md:shadow-none',
      )}
    >
      <div
        className={cn(
          'flex min-h-0 flex-col',
          fixedHeightClass ?? 'max-h-[85vh]',
          fixedHeightClass ? null : MIN_HEIGHT[size],
          SIZE[size],
          fullScreenOnSmall && SMALL_VIEWPORT,
          className,
        )}
      >
        {title || description || showClose ? (
          <>
            <header className="flex shrink-0 items-start justify-between gap-4 px-6 py-4">
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
                  className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground motion-safe:transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span aria-hidden className="text-base leading-none">
                    ×
                  </span>
                </button>
              ) : null}
            </header>
            {headerBordered ? <Divider /> : null}
          </>
        ) : null}
        {panel ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div
              className={cn(
                'flex shrink-0 flex-col gap-0.5 px-3 py-5',
                panelWidthClass,
                panelClassName,
              )}
            >
              {panel}
            </div>
            <Divider orientation="vertical" />
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-col overflow-y-auto text-sm',
                bodyClassName ?? 'gap-4 px-6 py-5',
              )}
            >
              {children}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col overflow-y-auto text-sm',
              bodyClassName ?? 'gap-4 px-6 py-5',
            )}
          >
            {children}
          </div>
        )}
        {footer ? (
          <>
            <Divider />
            <footer className="flex shrink-0 items-center justify-end gap-2 px-6 py-3">
              {footer}
            </footer>
          </>
        ) : null}
      </div>
    </dialog>
  );
};
