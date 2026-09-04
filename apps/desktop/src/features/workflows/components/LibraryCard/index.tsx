import { useState } from 'react';
import { ClampedProse, Tooltip, cn } from '@goodboy/ui';
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { StepDef } from '@goodboy/types';
import { agentKindPalette, ROLE_LABEL, ROLE_TO_KIND } from '../../../session/agent-kind';
import { AgentAvatar } from '../../../../shared/components/AgentAvatar';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

type Props = {
  readonly def: StepDef;
  readonly dragDisabled: boolean;
  readonly onStartDrag: (def: StepDef, e: React.PointerEvent) => void;
  readonly onAdd: () => void;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
};

export const LibraryCard = ({ def, dragDisabled, onStartDrag, onAdd, onEdit, onDelete }: Props) => {
  const [confirming, setConfirming] = useState(false);
  const kind = ROLE_TO_KIND[def.role] ?? 'generic';
  const isGlobal = def.workspaceId === null;
  return (
    <li
      onPointerDown={(e) => {
        if (dragDisabled) {
          return;
        }
        onStartDrag(def, e);
      }}
      className={cn(
        'group relative flex touch-none select-none items-start gap-2.5 rounded-md px-1.5 py-2.5 motion-safe:transition-colors hover:bg-muted/30',
        dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical
        size={ICON_SIZE.row}
        className="shrink-0 text-muted-foreground/25 motion-safe:transition-colors group-hover:text-muted-foreground/60"
        aria-hidden
      />
      <AgentAvatar kind={kind} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-20">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-xs font-medium text-foreground">{def.name}</span>
          <span className={cn('shrink-0 text-2xs font-medium', agentKindPalette({ kind }).fg)}>
            {ROLE_LABEL[def.role]}
          </span>
        </div>
        {def.promptPrefix ? (
          <ClampedProse
            text={def.promptPrefix}
            lines={2}
            className="text-2xs leading-relaxed text-muted-foreground/60"
          />
        ) : null}
      </div>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        {isGlobal ? (
          <span className="px-1 text-2xs uppercase tracking-eyebrow text-muted-foreground group-focus-within:hidden group-hover:hidden">
            global
          </span>
        ) : null}
        <Tooltip content="add to workflow">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onAdd}
            aria-label={`Add ${def.name} to workflow`}
            className="rounded-md p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            <Plus size={ICON_SIZE.row} aria-hidden />
          </button>
        </Tooltip>
        {confirming ? (
          <div
            className="flex items-center gap-0.5 rounded-md border border-border bg-background/95 px-1 py-0.5 shadow-sm"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="px-1 text-2xs text-muted-foreground">Delete?</span>
            <Tooltip content="confirm delete">
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onDelete();
                }}
                aria-label={`Confirm delete ${def.name}`}
                className="rounded-md p-0.5 text-danger motion-safe:transition-colors hover:bg-danger/10"
              >
                <Check size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
            <Tooltip content="cancel">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                aria-label="Cancel delete"
                className="rounded-md p-0.5 text-muted-foreground motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <X size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="hidden items-center gap-0.5 group-focus-within:flex group-hover:flex">
            <Tooltip content={isGlobal ? 'edit (creates a workspace copy)' : 'edit step'}>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onEdit}
                aria-label={`Edit ${def.name}`}
                className="rounded-md p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Pencil size={ICON_SIZE.row} aria-hidden />
              </button>
            </Tooltip>
            {!isGlobal && (
              <Tooltip content="delete step">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setConfirming(true)}
                  aria-label={`Delete ${def.name}`}
                  className="rounded-md p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus-ring)] motion-safe:transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={ICON_SIZE.row} aria-hidden />
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </li>
  );
};
