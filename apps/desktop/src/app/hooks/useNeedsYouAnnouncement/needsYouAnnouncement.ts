import type { Session } from '@goodboy/types';
import { sessionTitle } from '../../../shared/utils/sessionTitle';

type ReasonParams = {
  readonly session: Session;
};

type Params = {
  readonly previousIds: ReadonlySet<string>;
  readonly sessions: ReadonlyArray<Session>;
  readonly reasonOf: (params: ReasonParams) => string;
};

export const needsYouAnnouncement = ({
  previousIds,
  sessions,
  reasonOf,
}: Params): string | null => {
  const arrived = sessions.filter((session) => !previousIds.has(session.id));
  if (arrived.length === 0) {
    return null;
  }
  return arrived
    .map((session) => {
      const reason = reasonOf({ session });
      const title = sessionTitle({ session });
      return reason === '' ? `${title} needs you` : `${title} needs you: ${reason}`;
    })
    .join('. ');
};
