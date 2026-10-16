import { ChevronLeft } from 'lucide-react';
import { Tooltip, WorkNode, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { AgentKindChip } from '../../../shared/components/AgentKindChip';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { useAutoTreeActions } from '../../../features/auto/chat/useAutoTreeActions';
import { useAutoLevel } from '../../../features/auto/level/useAutoLevel';
import { RAIL_BUTTON_IDLE, RAIL_NODE_CURRENT, RailButton } from '../SideColumn/RailButton';

type Props = {
  readonly session: Session;
};

const RAIL_AUTO_BUTTON =
  'relative flex h-7 w-10 shrink-0 items-center justify-center gap-1 rounded-md motion-safe:transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring';

export const RailAutoLevel = ({ session }: Props) => {
  const level = useAutoLevel({ session });
  const pickRailLevel = useAppStore((state) => state.pickRailLevel);
  const actions = useAutoTreeActions({ sessionId: session.id });

  return (
    <div data-rail-level="auto" className="flex flex-col items-center gap-1 px-2">
      <RailButton
        id="level-back"
        icon={ChevronLeft}
        iconSize={ICON_SIZE.row}
        label={`Back to ${sessionTitle({ session })}`}
        shortcut="nav.back"
        isCurrent={false}
        isPage
        onSelect={() => pickRailLevel({ level: 'session' })}
      />
      {level.rows.map((row) => {
        const label = `${row.label}, ${row.word}`;
        const isCurrent = row.agentId === level.shownAgentId;
        return (
          <Tooltip key={row.id} content={label} side="right">
            <button
              type="button"
              data-rail-page={`auto-${row.id}`}
              aria-label={label}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={() => actions.openRow(row)}
              data-rail-auto-role={row.role}
              className={cn(RAIL_AUTO_BUTTON, isCurrent ? RAIL_NODE_CURRENT : RAIL_BUTTON_IDLE)}
            >
              <AgentKindChip kind={row.role} density="glyph" isDecorative />
              <WorkNode state={row.node} label={row.word} mark={{ kind: 'dot' }} size="sm" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
};
