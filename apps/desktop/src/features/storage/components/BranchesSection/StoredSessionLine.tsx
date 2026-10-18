import type { SessionId } from '@goodboy/types';
import { useSessionById } from '../../../../store';
import { sessionTitle } from '../../../session/sessionTitle';
import { QuietSessionLine } from './QuietSessionLine';

type Props = {
  readonly sessionId: SessionId;
};

export const StoredSessionLine = ({ sessionId }: Props) => {
  const session = useSessionById(sessionId);
  if (session === null) {
    return <QuietSessionLine label="No session" />;
  }
  return (
    <span className="truncate text-meta text-muted-foreground">{sessionTitle({ session })}</span>
  );
};
