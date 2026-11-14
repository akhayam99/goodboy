import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DrawerEdgeContext,
  PaneActionsContext,
  PaneTabsContext,
  ShellRailContext,
  useDrawerContentInset,
} from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionTools } from '../../../features/session/components/SessionTools';
import { SESSION_TOOL_RAIL_WIDTH } from '../../../features/session/components/SessionTools/sessionToolRailWidth';
import { SessionCostChip } from '../../../features/session/components/SessionOverviewPane/SessionCostChip';
import { ContextCardsContext } from '../../../features/session/contextCardsContext';
import { SessionHeaderActions } from '../SessionActions/SessionHeaderActions';
import { SessionContextCards } from '../SessionContextCards';
import { SessionPageTabs } from '../SessionPageTabs';

type Props = {
  readonly session: Session;
  readonly children: ReactNode;
};

export const SessionFrame = ({ session, children }: Props) => {
  const edgeHost = useContext(DrawerEdgeContext);
  const isRailInShell = useContext(ShellRailContext);
  useDrawerContentInset({ width: SESSION_TOOL_RAIL_WIDTH });
  return (
    <PaneTabsContext.Provider value={<SessionPageTabs session={session} />}>
      <PaneActionsContext.Provider value={<SessionHeaderActions session={session} />}>
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
            {isRailInShell ? null : (
              <SessionTools key={`tools-${session.id}`} sessionId={session.id} />
            )}
            {isRailInShell || edgeHost === null
              ? null
              : createPortal(
                  <SessionTools key={`edge-tools-${session.id}`} sessionId={session.id} />,
                  edgeHost,
                )}
          </div>
        </ContextCardsContext.Provider>
      </PaneActionsContext.Provider>
    </PaneTabsContext.Provider>
  );
};
