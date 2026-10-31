import { CircleDashed } from 'lucide-react';
import type { AgentRole } from '@goodboy/types';
import { cn, ICON_SIZE, WORK_META_COLUMN } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { agentKindPalette, kindForRole } from '../../agent-kind';
import { OrchestratedPlanSlot } from './OrchestratedPlanSlot';

type Props = {
  readonly kind: 'next' | 'left' | 'skipped';
  readonly label: string;
  readonly role?: AgentRole | null;
  readonly slotWidth: number;
};

export const OrchestratedPlanRow = ({ kind, label, role = null, slotWidth }: Props) => {
  const roleKind = role === null ? null : kindForRole({ role });
  return (
    <div data-plan-row={kind} className="flex h-8 min-w-0 items-center">
      <OrchestratedPlanSlot slotWidth={slotWidth}>
        <CircleDashed
          size={ICON_SIZE.mark}
          className={kind === 'next' ? 'text-info' : 'text-faint-foreground'}
        />
      </OrchestratedPlanSlot>
      <span className="flex min-w-0 flex-1 items-center gap-2 px-2 text-ui">
        <span className="w-14 shrink-0" />
        <span
          data-checklist-cell="role"
          className="flex w-28 shrink-0 items-center gap-1 text-meta"
        >
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
