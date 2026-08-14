import { Check, X } from 'lucide-react';
import { cn } from '../cn';

type Props = {
  readonly label: string;
  readonly confirmAria: string;
  readonly danger?: boolean;
  readonly busy?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export const ConfirmPill = ({
  label,
  confirmAria,
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: Props) => (
  <span className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm">
    <span className="px-0.5 text-2xs text-muted-foreground">{label}</span>
    <button
      type="button"
      onClick={onConfirm}
      disabled={busy}
      title={confirmAria}
      aria-label={confirmAria}
      className={cn(
        'rounded p-0.5 motion-safe:transition-colors disabled:opacity-50',
        danger ? 'text-danger hover:bg-danger/10' : 'text-foreground hover:bg-muted/60',
      )}
    >
      <Check size={12} aria-hidden />
    </button>
    <button
      type="button"
      onClick={onCancel}
      disabled={busy}
      title="Cancel"
      aria-label="Cancel"
      className="rounded p-0.5 text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
    >
      <X size={12} aria-hidden />
    </button>
  </span>
);
