import { checkWorkReasonOf } from './checkWorkReasonOf';
import { liveCheckWorkOf } from './liveCheckWorkOf';

type Params = Parameters<typeof liveCheckWorkOf>[0];

export const checkWorkLockOf = ({ state, sessionId, mountId }: Params): string | null => {
  const work = liveCheckWorkOf({ state, sessionId, mountId });
  return work === null ? null : checkWorkReasonOf({ work });
};
