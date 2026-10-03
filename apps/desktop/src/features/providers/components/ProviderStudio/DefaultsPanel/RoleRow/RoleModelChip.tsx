import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { StateBadge, cn } from '@goodboy/ui';
import type { RoleSetEntry } from '../../../../roleSetEntries';

type Props = {
  readonly entry: RoleSetEntry;
  readonly position: number;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onMove: (offset: -1 | 1) => void;
};

export const RoleModelChip = ({ entry, position, disabled, onRemove, onMove }: Props) => {
  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled || event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      onRemove();
      return;
    }
    if (!event.altKey) {
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(-1);
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      onMove(1);
    }
  };
  return (
    <span
      role="group"
      tabIndex={0}
      data-role-model={entry.choice.model}
      aria-label={`${entry.label}, position ${position}${entry.isGone ? ', no longer in the catalog' : ''}`}
      onKeyDown={onKeyDown}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background pl-2 pr-1 text-label outline-none focus-visible:ring-1 focus-visible:ring-primary"
    >
      <span className="w-2.5 text-meta text-faint-foreground">{position}</span>
      <span className={cn(entry.isGone && 'text-faint-foreground line-through')}>
        {entry.label}
      </span>
      {entry.isGone ? <StateBadge>Gone, skipped</StateBadge> : null}
      <button
        type="button"
        disabled={disabled}
        aria-label={`Remove ${entry.label}`}
        title="Remove"
        onClick={onRemove}
        className="grid size-5 place-items-center rounded-sm text-faint-foreground hover:bg-hover hover:text-foreground disabled:cursor-not-allowed"
      >
        <X size={12} aria-hidden />
      </button>
    </span>
  );
};
