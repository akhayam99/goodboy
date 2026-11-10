import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DrawerEdgeContext, ShellRailContext } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionTools } from '../../../features/session/components/SessionTools';
import { SessionCostChip } from '../../../features/session/components/SessionOverviewPane/SessionCostChip';
import { SessionRailFoldContext } from '../../../features/session/sessionRailFoldContext';
import { useSessionRailSizing } from './useSessionRailSizing';
import { SessionRail } from './index';

type Props = {
  readonly session: Session;
  readonly children: ReactNode;
};

export const SessionFrame = ({ session, children }: Props) => {
  const edgeHost = useContext(DrawerEdgeContext);
  const isRailInShell = useContext(ShellRailContext);
  const sizing = useSessionRailSizing();
  return (
    <SessionRailFoldContext value={sizing.fold.isFolded}>
      <div data-session-frame="" className="relative flex h-full w-full min-w-0">
        <SessionRail key={session.id} session={session} sizing={sizing} />
        <div className="pointer-events-none absolute bottom-2 left-2 flex">
          <SessionCostChip
            key={`spend-${session.id}`}
            sessionId={session.id}
            placement="editHost"
          />
        </div>
        <div className="relative h-full min-w-0 flex-1">{children}</div>
        {isRailInShell ? null : <SessionTools key={`tools-${session.id}`} sessionId={session.id} />}
        {isRailInShell || edgeHost === null
          ? null
          : createPortal(
              <SessionTools key={`edge-tools-${session.id}`} sessionId={session.id} />,
              edgeHost,
            )}
      </div>
    </SessionRailFoldContext>
  );
};
