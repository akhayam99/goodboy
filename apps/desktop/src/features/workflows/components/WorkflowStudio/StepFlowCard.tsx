import { cn } from '@goodboy/ui';
import { ChevronLeft, ChevronRight, GripVertical, X } from 'lucide-react';
import { getDefaultTurnModel } from '@goodboy/core';
import type { ProviderId } from '@goodboy/types';
import type { DefinitionForm } from '../../form';
import { AGENT_KIND_PALETTE, ROLE_LABEL, ROLE_TO_KIND } from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { shortModel } from '../../../session/agent-row-format';

type Props = {
  readonly def: DefinitionForm;
  readonly ordinal: number;
  readonly total: number;
  readonly selected: boolean;
  readonly isDragging: boolean;
  readonly connectedProviders: ReadonlyArray<ProviderId>;
  readonly onSelect: () => void;
  readonly onStartDrag: (e: React.PointerEvent) => void;
  readonly onRemove: () => void;
  readonly onMoveLeft: () => void;
  readonly onMoveRight: () => void;
};

export function StepFlowCard({
  def,
  ordinal,
  total,
  selected,
  isDragging,
  connectedProviders,
  onSelect,
  onStartDrag,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: Props) {
  const kind = ROLE_TO_KIND[def.role];
  const effProvider: ProviderId =
    (def.providerOverride as ProviderId) || connectedProviders[0] || 'anthropic';
  const modelValue = def.modelOverride || getDefaultTurnModel(effProvider);

  return (
    <div
      className={cn(
        'group relative flex w-52 shrink-0 flex-col gap-2 overflow-hidden rounded-xl border p-3 transition-colors',
        selected
          ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
          : 'border-border-soft bg-muted/10 hover:border-border hover:bg-muted/30',
        isDragging && 'opacity-40',
      )}
    >
      <span
        className={cn('absolute inset-x-0 top-0 h-1', AGENT_KIND_PALETTE[kind].bg)}
        aria-hidden
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onPointerDown={onStartDrag}
          title="drag to reorder"
          aria-label="drag to reorder step"
          className="-ml-1 shrink-0 cursor-grab touch-none rounded p-0.5 text-muted-foreground/30 transition-colors hover:text-muted-foreground/70 active:cursor-grabbing"
        >
          <GripVertical size={13} aria-hidden />
        </button>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/60 text-2xs font-mono font-semibold text-muted-foreground">
          {ordinal + 1}
        </span>
        <AgentAvatar kind={kind} size="sm" />
        <div className="ml-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveLeft}
            disabled={ordinal === 0}
            title="move left"
            aria-label="move step left"
          >
            <ChevronLeft size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-25"
            onClick={onMoveRight}
            disabled={ordinal === total - 1}
            title="move right"
            aria-label="move step right"
          >
            <ChevronRight size={13} aria-hidden />
          </button>
          <button
            type="button"
            className="rounded p-1 text-muted-foreground hover:bg-danger/10 hover:text-danger"
            onClick={onRemove}
            title="remove step"
            aria-label="remove step"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      </div>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-col gap-1 text-left">
        <span className="truncate text-sm font-medium text-foreground">
          {def.name || 'untitled step'}
        </span>
        <span className={cn('text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}>
          {ROLE_LABEL[def.role]}
        </span>
        <span className="truncate font-mono text-[10px] text-muted-foreground/60">
          {shortModel(modelValue)} · {def.verbosity}
        </span>
      </button>
    </div>
  );
}
