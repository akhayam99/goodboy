import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../cn';
import { formatError } from '../formatError';
import { tintClasses, type Tone } from '../tint';
import { Button, type ButtonVariant } from './Button';
import { ToneBar } from './ToneBar';

export type ConfirmRole = 'primary' | 'alert' | 'danger';

export type ConfirmSurface = 'card' | 'plain';

export type ConfirmAltAction = {
  readonly label: string;
  readonly onClick: () => void;
  readonly icon?: ReactNode;
  readonly disabled?: boolean;
};

type Props = {
  readonly role: ConfirmRole;
  readonly icon: ReactNode;
  readonly title: string;
  readonly description?: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly altAction?: ConfirmAltAction;
  readonly note?: ReactNode;
  readonly children?: ReactNode;
  readonly onConfirm: () => void | Promise<void>;
  readonly onCancel: () => void;
  readonly isBusy?: boolean;
  readonly isConfirmDisabled?: boolean;
  readonly autoDisarmMs?: number;
  readonly surface?: ConfirmSurface;
  readonly className?: string;
};

const ROLE_TONE: Record<ConfirmRole, Tone> = {
  primary: 'primary',
  alert: 'warning',
  danger: 'danger',
};

const ROLE_VARIANT: Record<ConfirmRole, ButtonVariant> = {
  primary: 'primary',
  alert: 'primary',
  danger: 'danger',
};

export const InlineConfirm = ({
  role,
  icon,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  altAction,
  note,
  children,
  onConfirm,
  onCancel,
  isBusy = false,
  isConfirmDisabled = false,
  autoDisarmMs,
  surface = 'card',
  className,
}: Props) => {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tone = ROLE_TONE[role];
  const tint = tintClasses(tone);
  const busy = isBusy || isRunning;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    if (autoDisarmMs === undefined || busy || error !== null) {
      return;
    }
    const timer = window.setTimeout(() => cancelRef.current(), autoDisarmMs);
    return () => window.clearTimeout(timer);
  }, [autoDisarmMs, busy, error]);

  const confirm = async () => {
    setIsRunning(true);
    setError(null);
    try {
      await onConfirm();
    } catch (caught) {
      setError(formatError(caught));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div
      role="group"
      aria-label={title}
      data-surface={surface}
      className={cn(
        'flex min-w-0 flex-col gap-2 text-meta',
        surface === 'card'
          ? 'relative rounded-lg border border-border-soft bg-subtle py-3 pr-3 pl-4'
          : 'p-3',
        className,
      )}
    >
      {surface === 'card' ? <ToneBar tone={tone} density="card" /> : null}
      <div className="flex min-w-0 items-start gap-2">
        <span className={cn('flex h-4 shrink-0 items-center', tint.icon)} aria-hidden>
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
      {error !== null && error !== '' && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      <div
        className={cn(
          'flex min-w-0 flex-wrap items-center gap-2',
          altAction != null ? 'justify-between' : 'justify-end',
        )}
      >
        {altAction != null && (
          <Button
            variant="ghost"
            size="sm"
            onClick={altAction.onClick}
            disabled={busy || altAction.disabled === true}
          >
            {altAction.icon}
            {altAction.label}
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            data-confirm-cancel
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={ROLE_VARIANT[role]}
            size="sm"
            data-confirm-action
            onClick={() => void confirm()}
            disabled={busy || isConfirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
