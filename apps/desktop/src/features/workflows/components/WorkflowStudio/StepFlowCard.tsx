import { cn } from '@goodboy/ui';
import { ChevronLeft, ChevronRight, GripVertical, X } from 'lucide-react';
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
}: Props) => {
  const kind = ROLE_TO_KIND[def.role];
  const modelLabel = def.modelOverride ? shortModel(def.modelOverride) : 'auto';

  return (
    <div
      className={cn(
        'group relative w-44 shrink-0 rounded-lg border transition-colors',
        selected
          ? 'border-primary/40 bg-primary/5'
          : 'border-border-soft hover:border-border hover:bg-muted/20',
        isDragging && 'opacity-40',
      )}
    >
      <button
        type="button"
        onPointerDown={onStartDrag}
        title="drag to reorder"
        aria-label="drag to reorder step"
        className="absolute left-0 top-1/2 -translate-y-1/2 cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100"
      >
        <GripVertical size={12} aria-hidden />
      </button>

      <button
        type="button"
        onClick={onSelect}
        className="flex w-full min-w-0 flex-col gap-0.5 px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="shrink-0 font-mono text-2xs text-muted-foreground/50">
            {ordinal + 1}
          </span>
          <span className="truncate text-xs font-medium text-foreground">
            {def.name || 'untitled step'}
          </span>
        </span>
        <span className="flex min-w-0 items-baseline gap-1.5 pl-3.5">
          <span className={cn('truncate text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}>
            {ROLE_LABEL[def.role]}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground/50">
            {modelLabel}
          </span>
        </span>
      </button>

      <div className="absolute right-1 top-1 flex items-center rounded bg-background/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
          onClick={onMoveLeft}
          disabled={ordinal === 0}
          title="move left"
          aria-label="move step left"
        >
          <ChevronLeft size={12} aria-hidden />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
          onClick={onMoveRight}
          disabled={ordinal === total - 1}
          title="move right"
          aria-label="move step right"
        >
          <ChevronRight size={12} aria-hidden />
        </button>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
          onClick={onRemove}
          title="remove step"
          aria-label="remove step"
        >
          <X size={12} aria-hidden />
        </button>
      </div>
    </div>
  );
};
