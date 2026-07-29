import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { tintClasses, type Tone } from '../tint';

export type ConfirmRole = 'primary' | 'alert' | 'danger';

export type InlineConfirmProps = {
  readonly role: ConfirmRole;
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly note?: ReactNode;
  readonly children?: ReactNode;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel: () => void;
  readonly isBusy?: boolean;
  readonly autoDisarmMs?: number;
  readonly className?: string;
};

const ROLE_TONE: Record<ConfirmRole, Tone> = {
  primary: 'primary',
  alert: 'warning',
  danger: 'danger',
};

const ROLE_CONFIRM: Record<ConfirmRole, string> = {
  primary: 'bg-primary text-primary-foreground',
  alert: 'bg-warning text-warning-foreground',
  danger: 'bg-danger text-danger-foreground',
};

export const InlineConfirm = ({
  role,
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  note,
  children,
  onConfirm,
  onCancel,
  isBusy = false,
  autoDisarmMs,
  className,
}: InlineConfirmProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const tint = tintClasses(ROLE_TONE[role]);
  const busy = isBusy || isRunning;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (autoDisarmMs === undefined || busy) {
      return;
    }
    const timer = window.setTimeout(() => cancelRef.current(), autoDisarmMs);
    return () => window.clearTimeout(timer);
  }, [autoDisarmMs, busy]);

  const confirm = async () => {
    setIsRunning(true);
    try {
      await onConfirm();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={title}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-lg border p-2.5 text-2xs',
        tint.border,
        tint.bg,
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        <span className={cn('mt-px flex shrink-0 items-center', tint.icon)} aria-hidden>
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-semibold text-foreground">{title}</p>
          {description != null && description !== '' && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {children}
      {note}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-border px-2 py-0.5 font-semibold text-foreground motion-safe:transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className={cn(
            'rounded-md px-2 py-0.5 font-semibold motion-safe:transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
            ROLE_CONFIRM[role],
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};
