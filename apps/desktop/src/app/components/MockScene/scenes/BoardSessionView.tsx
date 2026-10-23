import type { Session } from '@goodboy/types';
import { KeepAliveWorkSurface } from '../../KeepAliveWorkSurface';
import { SessionFrame } from '../../SessionRail/SessionFrame';

type Props = {
  readonly session: Session;
};

export const BoardSessionView = ({ session }: Props) => (
  <SessionFrame session={session}>
    <KeepAliveWorkSurface sessionId={session.id} isActive />
  </SessionFrame>
);
