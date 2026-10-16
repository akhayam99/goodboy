import { ChevronLeft } from 'lucide-react';
import { Tooltip, WorkNode, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { sessionTitle } from '../../../features/session/sessionTitle';
import { useAutoTreeActions } from '../../../features/auto/chat/useAutoTreeActions';
import { useAutoLevel } from '../../../features/auto/level/useAutoLevel';
import { RAIL_BUTTON_IDLE, RAIL_NODE_BUTTON, RAIL_NODE_CURRENT, RailButton } from './RailButton';

type Props = {
  readonly session: Session;
};

export const RailAutoLevel = ({ session }: Props) => {
  const level = useAutoLevel({ session });
  const pickSidebarLevel = useAppStore((state) => state.pickSidebarLevel);
  const actions = useAutoTreeActions({ sessionId: session.id });

  return (
    <div data-rail-level="auto" className="flex flex-col items-center gap-1">
      <RailButton
        id="level-back"
        icon={ChevronLeft}
        label={`Back to ${sessionTitle({ session })}`}
        shortcut="nav.back"
        isCurrent={false}
        isPage
        onSelect={() => pickSidebarLevel({ level: 'session' })}
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
              className={cn(RAIL_NODE_BUTTON, isCurrent ? RAIL_NODE_CURRENT : RAIL_BUTTON_IDLE)}
            >
              <WorkNode state={row.node} label={label} mark={{ kind: 'dot' }} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
};
