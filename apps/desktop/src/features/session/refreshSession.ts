import type { SessionId } from '@goodboy/types';
import type { ReportErrorParams } from '../../store/slices/notifications/reportError';
import type { ResyncSessionParams } from '../../store/slices/session-sync/types';

const REFRESH_FAILED_TITLE = "Couldn't refresh this session";

type Params = {
  readonly sessionId: SessionId;
  readonly resyncSession: (params: ResyncSessionParams) => Promise<void>;
  readonly reportError: (params: ReportErrorParams) => Promise<void>;
};

export const refreshSession = async ({
  sessionId,
  resyncSession,
  reportError,
}: Params): Promise<void> => {
  try {
    await resyncSession({ sessionId });
  } catch (error) {
    await reportError({ title: REFRESH_FAILED_TITLE, error, sessionId });
  }
};
