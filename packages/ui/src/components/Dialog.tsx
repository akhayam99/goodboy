import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '../cn';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
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

  return (
    <dialog
      ref={ref}
      className={cn(
        'rounded-lg border border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-black/40',
        className,
      )}
    >
      <div className="flex min-w-72 flex-col gap-4 p-5">
        {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
        {children}
      </div>
    </dialog>
  );
}
