import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { DrawerEdgeContext } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionTools } from '../../../features/session/components/SessionTools';
import { SessionRail } from './index';

type Props = {
  readonly session: Session;
  readonly children: ReactNode;
};

export const SessionFrame = ({ session, children }: Props) => {
  const edgeHost = useContext(DrawerEdgeContext);
  return (
    <div data-session-frame="" className="flex h-full w-full min-w-0">
      <SessionRail key={session.id} session={session} />
      <div className="relative h-full min-w-0 flex-1">{children}</div>
      <SessionTools key={`tools-${session.id}`} sessionId={session.id} />
      {edgeHost === null
        ? null
        : createPortal(
            <SessionTools key={`edge-tools-${session.id}`} sessionId={session.id} />,
            edgeHost,
          )}
    </div>
  );
};
