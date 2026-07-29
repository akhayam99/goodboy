import { cn } from '@goodboy/ui';
import { Check, X } from 'lucide-react';

type Props = {
  readonly isBusy: boolean;
  readonly onSave: () => void;
  readonly onCancel: () => void;
};

export const SaveCancel = ({ isBusy, onSave, onCancel }: Props) => {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={onSave}
        disabled={isBusy}
        title="save"
        aria-label="save"
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50',
          isBusy ? 'animate-border-pulse' : null,
        )}
      >
        <Check size={14} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={isBusy}
        title="cancel"
        aria-label="cancel"
        className="inline-flex items-center justify-center rounded-md border border-border-soft p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
};
