import type { Session, SessionId } from '@goodboy/types';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { isLiveSession } from '../../shared/utils/isLiveSession';
import { sessionTitle } from '../../shared/utils/sessionTitle';

export const CONSOLE_SEND_TARGET_MAX = 5;

type Params = {
  readonly sessions: ReadonlyArray<Session>;
  readonly sessionId: SessionId;
};

export type ConsoleSendTarget = {
  readonly sessionId: SessionId;
  readonly title: string;
  readonly isCurrent: boolean;
};

export const consoleSendTargetsOf = ({
  sessions,
  sessionId,
}: Params): ReadonlyArray<ConsoleSendTarget> => {
  const current = sessionById(sessions, sessionId);
  if (current === undefined) {
    return [];
  }
  const others = sessions.filter(
    (session) =>
      session.id !== sessionId &&
      session.workspaceId === current.workspaceId &&
      isLiveSession({ session }),
  );
  return [...(isLiveSession({ session: current }) ? [current] : []), ...others]
    .slice(0, CONSOLE_SEND_TARGET_MAX)
    .map((session) => ({
      sessionId: session.id,
      title: sessionTitle({ session }),
      isCurrent: session.id === sessionId,
    }));
};
