import type { ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react';
import type { DefinitionForm } from '../../form';
import { AGENT_KIND_PALETTE, ROLE_LABEL, ROLE_TO_KIND } from '../../../session/agent-kind';
import { shortModel } from '../../../session/agent-row-format';

type Props = {
  readonly def: DefinitionForm;
  readonly ordinal: number;
  readonly total: number;
  readonly selected: boolean;
  readonly isDragging: boolean;
  readonly onSelect: () => void;
  readonly onStartDrag: (e: React.PointerEvent) => void;
  readonly onRemove: () => void;
  readonly onMoveLeft: () => void;
  readonly onMoveRight: () => void;
  readonly editor?: ReactNode;
};

export const StepFlowCard = ({
  def,
  ordinal,
  total,
  selected,
  isDragging,
  onSelect,
  onStartDrag,
  onRemove,
  onMoveLeft,
  onMoveRight,
  editor,
}: Props) => {
  const kind = ROLE_TO_KIND[def.role] ?? 'generic';
  const modelLabel = def.modelOverride ? shortModel(def.modelOverride) : 'auto';

  return (
    <div
      className={cn(
        'group relative w-full shrink-0 rounded-lg border motion-safe:transition-colors',
        selected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border-soft hover:border-border hover:bg-muted/20',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onPointerDown={onStartDrag}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onMoveLeft();
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onMoveRight();
            }
          }}
          title="drag to reorder (or arrow keys)"
          aria-label="reorder step, use up and down arrow keys"
          className="flex shrink-0 cursor-grab touch-none items-center rounded-l-lg px-1 text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-focus-ring)] active:cursor-grabbing motion-safe:transition-colors hover:bg-muted/40 hover:text-muted-foreground"
        >
          <GripVertical size={14} aria-hidden />
        </button>

        <button
          type="button"
          onClick={onSelect}
          aria-expanded={selected}
          className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2.5 text-left"
        >
          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/50">
            {String(ordinal + 1).padStart(2, '0')}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
            {def.name || 'untitled step'}
          </span>
          <span
            className={cn('shrink-0 truncate text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}
          >
            {ROLE_LABEL[def.role]}
          </span>
          <span className="shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/50">
            {modelLabel}
          </span>
          <ChevronDown
            size={13}
            aria-hidden
            className={cn(
              'shrink-0 text-muted-foreground/50 motion-safe:transition-transform',
              selected && 'rotate-180',
            )}
          />
        </button>

        <div className="flex shrink-0 items-center gap-px self-start px-1 py-1 opacity-0 focus-within:opacity-100 motion-safe:transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveLeft}
            disabled={ordinal === 0}
            title="move up"
            aria-label="move step up"
          >
            <ChevronUp size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveRight}
            disabled={ordinal === total - 1}
            title="move down"
            aria-label="move step down"
          >
            <ChevronDown size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] hover:bg-danger/10 hover:text-danger"
            onClick={onRemove}
            title="remove step"
            aria-label="remove step"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      </div>

      {selected && editor ? <div className="px-2 pb-3 pt-0">{editor}</div> : null}
    </div>
  );
};
