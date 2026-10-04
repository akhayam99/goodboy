import { Undo2 } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PolishField } from '../../stepPolishFields';

type Props = {
  readonly htmlFor: string;
  readonly label: string;
  readonly hint?: string;
  readonly polish: PolishField | null;
  readonly isPolishable: boolean;
  readonly disabled: boolean;
};

const LINK_CLASS =
  'inline-flex items-center gap-1 rounded-sm px-1 text-meta text-faint-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

export const StepFieldLabel = ({ htmlFor, label, hint, polish, isPolishable, disabled }: Props) => (
  <div className="flex min-h-5 items-center justify-between gap-2">
    <label htmlFor={htmlFor} className="min-w-0 truncate text-meta text-muted-foreground">
      {label}
      {hint === undefined ? null : <span className="text-faint-foreground">{` · ${hint}`}</span>}
    </label>
    {polish === null ? null : polish.canUndo ? (
      <button
        type="button"
        onClick={polish.onUndo}
        disabled={disabled}
        aria-label={`Undo polish of ${label.toLowerCase()}`}
        className={LINK_CLASS}
      >
        <Undo2 size={ICON_SIZE.row} aria-hidden />
        Undo polish
      </button>
    ) : (
      <button
        type="button"
        onClick={polish.onPolish}
        disabled={disabled || polish.isBusy || !isPolishable}
        aria-label={`Polish ${label.toLowerCase()}`}
        className={LINK_CLASS}
      >
        <CONCEPT_ICONS.enhance size={ICON_SIZE.row} aria-hidden />
        <span className={cn(polish.isPolishing && 'text-shimmer')}>Polish</span>
      </button>
    )}
  </div>
);
