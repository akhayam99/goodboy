import { CircleDashed, MessageSquareText } from 'lucide-react';
import type { AgentRole } from '@goodboy/types';
import { WORK_META_COLUMN, cn } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { railColumnX } from '../../../workTreeModel/railGeometry';
import { agentKindPalette, kindForRole } from '../../agent-kind';

type Props = {
  readonly kind: 'hint' | 'next' | 'left';
  readonly label: string;
  readonly role?: AgentRole | null;
  readonly slotWidth: number;
};

export const OrchestratedPlanRow = ({ kind, label, role = null, slotWidth }: Props) => {
  const roleKind = role === null ? null : kindForRole({ role });
  return (
    <div data-plan-row={kind} className="flex h-8 min-w-0 items-center">
      <span aria-hidden className="relative h-full shrink-0" style={{ width: slotWidth }}>
        <span
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
          style={{ left: railColumnX({ column: 0 }) }}
        >
          {kind === 'hint' ? (
            <MessageSquareText size={ICON_SIZE.mark} className="text-faint-foreground" />
          ) : (
            <CircleDashed
              size={ICON_SIZE.mark}
              className={kind === 'next' ? 'text-info' : 'text-faint-foreground'}
            />
          )}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 px-2 text-ui">
        <span className="w-14 shrink-0" />
        <span data-checklist-cell="role" className="flex w-28 shrink-0 items-center gap-1">
          {roleKind === null ? null : (
            <>
              <AgentKindChip kind={roleKind} density="glyph" isDecorative />
              <span className="min-w-0 truncate text-muted-foreground">
                {agentKindPalette({ kind: roleKind }).label}
              </span>
            </>
          )}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            kind === 'left' ? 'text-muted-foreground' : 'text-faint-foreground',
          )}
        >
          {label}
        </span>
        <span aria-hidden className={WORK_META_COLUMN.stack} />
      </span>
    </div>
  );
};
