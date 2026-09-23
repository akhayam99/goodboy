import { ClampedProse, ConfirmPopover, Tooltip, cn, tintClasses, Eyebrow } from '@goodboy/ui';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { StepDef } from '@goodboy/types';
import { agentKindPalette, kindForRole, ROLE_LABEL } from '../../../session/agent-kind';
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
  const kind = kindForRole({ role: def.role });
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
        'group relative flex touch-none select-none items-start gap-2.5 rounded-md px-1.5 py-2.5 motion-safe:transition-colors hover:bg-hover',
        dragDisabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <GripVertical
        size={ICON_SIZE.row}
        className="shrink-0 text-faint-foreground motion-safe:transition-colors group-hover:text-faint-foreground"
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
            className="text-2xs leading-relaxed text-faint-foreground"
          />
        ) : null}
      </div>

      <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
        {isGlobal ? (
          <Eyebrow label="global" className="px-1 group-focus-within:hidden group-hover:hidden" />
        ) : null}
        <Tooltip content="add to workflow">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onAdd}
            aria-label={`Add ${def.name} to workflow`}
            className="rounded-md p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors hover:bg-hover hover:text-foreground"
          >
            <Plus size={ICON_SIZE.row} aria-hidden />
          </button>
        </Tooltip>
        <div onPointerDown={(e) => e.stopPropagation()}>
          <ConfirmPopover
            role="danger"
            icon={<Trash2 size={ICON_SIZE.row} aria-hidden />}
            title={`Delete ${def.name}?`}
            description="Removes this step from the library."
            confirmLabel="Delete step"
            onConfirm={onDelete}
            trigger={({ isArmed, arm }) => (
              <div
                className={cn(
                  'items-center gap-0.5 group-focus-within:flex group-hover:flex',
                  isArmed ? 'flex' : 'hidden',
                )}
              >
                <Tooltip content={isGlobal ? 'edit (creates a workspace copy)' : 'edit step'}>
                  <button
                    type="button"
                    onClick={onEdit}
                    aria-label={`Edit ${def.name}`}
                    className="rounded-md p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors hover:bg-hover hover:text-foreground"
                  >
                    <Pencil size={ICON_SIZE.row} aria-hidden />
                  </button>
                </Tooltip>
                {!isGlobal && (
                  <Tooltip content="delete step">
                    <button
                      type="button"
                      onClick={arm}
                      aria-label={`Delete ${def.name}`}
                      aria-expanded={isArmed}
                      className={cn(
                        'rounded-md p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring motion-safe:transition-colors',
                        tintClasses('danger').hoverBg,
                        'hover:text-danger',
                      )}
                    >
                      <Trash2 size={ICON_SIZE.row} aria-hidden />
                    </button>
                  </Tooltip>
                )}
              </div>
            )}
          />
        </div>
      </div>
    </li>
  );
};
