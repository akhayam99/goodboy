import { Activity } from 'react';
import { PaneActionsContext, PaneTabsContext } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { ContextCardsContext } from '../../../features/session/contextCardsContext';
import { SessionWorkspace } from '../../../features/session/components/SessionWorkspace';
import { useSessionById } from '../../../store';
import { useGoToBoard } from '../../hooks/useGoToBoard';
import { PanelBoundary } from '../PanelBoundary';
import { SessionContextCards } from '../SessionContextCards';
import { SessionHeaderActions } from '../SessionActions/SessionHeaderActions';
import { SessionPageTabs } from '../SessionPageTabs';

type KeepAliveWorkSurfaceProps = {
  readonly sessionId: SessionId;
  readonly isActive: boolean;
};

export const KeepAliveWorkSurface = ({ sessionId, isActive }: KeepAliveWorkSurfaceProps) => {
  const session = useSessionById(sessionId);
  const goToBoard = useGoToBoard();
  if (!session) {
    return null;
  }
  return (
    <Activity mode={isActive ? 'visible' : 'hidden'}>
      <div className="absolute inset-0" data-browser-session={sessionId}>
        <PanelBoundary leaveLabel="Go to the board" onLeave={goToBoard}>
          <PaneTabsContext.Provider value={<SessionPageTabs session={session} />}>
            <PaneActionsContext.Provider value={<SessionHeaderActions session={session} />}>
              <ContextCardsContext.Provider value={SessionContextCards}>
                <SessionWorkspace session={session} />
              </ContextCardsContext.Provider>
            </PaneActionsContext.Provider>
          </PaneTabsContext.Provider>
        </PanelBoundary>
      </div>
    </Activity>
  );
};
