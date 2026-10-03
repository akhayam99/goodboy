import type { SessionId } from '@goodboy/types';
import { useSessionById } from '../../../../store';
import { LiveSessionCells } from './LiveSessionCells';
import { QuietSessionCells } from './QuietSessionCells';

type Props = {
  readonly sessionId: SessionId;
};

export const StoredSessionCells = ({ sessionId }: Props) => {
  const session = useSessionById(sessionId);
  if (session === null) {
    return <QuietSessionCells label="No session" />;
  }
  return <LiveSessionCells session={session} />;
};
