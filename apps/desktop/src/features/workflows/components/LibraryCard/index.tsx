import { useState } from 'react';
import { cn } from '@goodboy/ui';
import { Check, GripVertical, Pencil, Trash2, X } from 'lucide-react';
import type { StepDef } from '@goodboy/types';
import { AGENT_KIND_PALETTE, ROLE_LABEL, ROLE_TO_KIND } from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';

interface Props {
  readonly def: StepDef;
  readonly dragDisabled: boolean;
  readonly onStartDrag: (def: StepDef, e: React.PointerEvent) => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

export function LibraryCard({ def, dragDisabled, onStartDrag, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const kind = ROLE_TO_KIND[def.role];
  const isGlobal = def.workspaceId === null;
  return (
    <li
      onPointerDown={(e) => {
        if (dragDisabled) return;
        onStartDrag(def, e);
      }}
      className={cn(
        'group relative flex touch-none select-none items-start gap-2 rounded-lg border border-border-soft bg-subtle px-3 py-2 transition-colors hover:border-border hover:bg-muted/50',
        dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical
        size={13}
        className="mt-0.5 shrink-0 text-muted-foreground/25 transition-colors group-hover:text-muted-foreground/60"
        aria-hidden
      />
      <AgentAvatar kind={kind} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate pr-2 text-xs font-medium text-foreground">{def.name}</span>
        <span className={cn('text-2xs font-medium', AGENT_KIND_PALETTE[kind].fg)}>
          {ROLE_LABEL[def.role]}
        </span>
        {def.promptPrefix ? (
          <span className="line-clamp-2 text-2xs leading-relaxed text-muted-foreground/70">
            {def.promptPrefix}
          </span>
        ) : null}
      </div>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        {isGlobal ? (
          <span className="rounded bg-muted/60 px-1 text-[9px] uppercase tracking-wide text-muted-foreground/60 group-hover:hidden">
            global
          </span>
        ) : null}
        {confirming ? (
          <div
            className="flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="px-1 text-2xs text-muted-foreground">Delete?</span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              title="confirm delete"
              aria-label={`confirm delete ${def.name}`}
              className="rounded p-0.5 text-danger transition-colors hover:bg-danger/10"
            >
              <Check size={12} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              title="cancel"
              aria-label="cancel delete"
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <X size={12} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="hidden items-center gap-0.5 group-hover:flex">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onEdit}
              title={isGlobal ? 'edit (creates a workspace copy)' : 'edit step'}
              aria-label={`edit ${def.name}`}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Pencil size={12} aria-hidden />
            </button>
            {!isGlobal ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setConfirming(true)}
                title="delete step"
                aria-label={`delete ${def.name}`}
                className="rounded p-1 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={12} aria-hidden />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}
