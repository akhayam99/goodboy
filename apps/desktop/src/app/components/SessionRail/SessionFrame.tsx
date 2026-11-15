import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DrawerEdgeContext, ShellRailContext } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionTools } from '../../../features/session/components/SessionTools';
import { SessionCostChip } from '../../../features/session/components/SessionOverviewPane/SessionCostChip';
import { ContextCardsContext } from '../../../features/session/contextCardsContext';
import { SessionHeadContext } from '../../../features/session/sessionHeadContext';
import { SessionContextCards } from '../SessionContextCards';
import { SessionHead } from '../SessionHead';

type Props = {
  readonly session: Session;
  readonly children: ReactNode;
};

export const SessionFrame = ({ session, children }: Props) => {
  const edgeHost = useContext(DrawerEdgeContext);
  const isRailInShell = useContext(ShellRailContext);
  return (
    <SessionHeadContext.Provider value={SessionHead}>
      <ContextCardsContext.Provider value={SessionContextCards}>
        <div data-session-frame="" className="relative flex h-full w-full min-w-0">
          <div className="pointer-events-none absolute bottom-2 left-2 flex">
            <SessionCostChip
              key={`spend-${session.id}`}
              sessionId={session.id}
              placement="editHost"
            />
          </div>
          <div className="relative h-full min-w-0 flex-1">{children}</div>
          {isRailInShell ? null : edgeHost === null ? (
            <SessionTools key={`tools-${session.id}`} sessionId={session.id} />
          ) : (
            createPortal(
              <SessionTools key={`tools-${session.id}`} sessionId={session.id} />,
              edgeHost,
            )
          )}
        </div>
      </ContextCardsContext.Provider>
    </SessionHeadContext.Provider>
  );
};
