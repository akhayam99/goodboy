import type { SessionId } from '@goodboy/types';
import { latestStampMs } from './latestStampMs';
import { requestsOfSession, type RequestsState } from './requestsOfSession';

type Params = {
  readonly state: RequestsState;
  readonly sessionId: SessionId;
};

export const requestChangedAtOf = ({ state, sessionId }: Params): number | null => {
  const { prs, mrs } = requestsOfSession({ state, sessionId });
  return latestStampMs({
    stamps: [
      ...prs.flatMap((pr) => [pr.updatedAt, pr.mergedAt]),
      ...mrs.flatMap((mr) => [mr.updatedAt, mr.mergedAt]),
    ],
  });
};
