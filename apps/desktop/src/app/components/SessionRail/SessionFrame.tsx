import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { SessionTools } from '../../../features/session/components/SessionTools';
import { SessionRail } from './index';

type Props = {
  readonly session: Session;
  readonly children: ReactNode;
};

export const SessionFrame = ({ session, children }: Props) => (
  <div data-session-frame="" className="flex h-full w-full min-w-0">
    <SessionRail key={session.id} session={session} />
    <div className="relative h-full min-w-0 flex-1">{children}</div>
    <SessionTools key={`tools-${session.id}`} sessionId={session.id} />
  </div>
);
