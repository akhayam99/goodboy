import { formatError } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ReportedError } from '../notifications/reportedError';
import type { GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  workspaceId: WorkspaceId;
  title: string;
  isQuiet?: boolean;
  isFailureShown?: boolean;
  run: () => Promise<void>;
}>;

export const runPortWrite = async ({
  get,
  sessionId,
  workspaceId,
  title,
  isQuiet = false,
  isFailureShown = false,
  run,
}: Params): Promise<void> => {
  try {
    await run();
  } catch (error) {
    const message = formatError(error);
    if (!isQuiet) {
      void get().emitNotification({
        kind: 'error',
        severity: 'error',
        title,
        body: message,
        sessionId,
        workspaceId,
        isRead: isFailureShown,
      });
    }
    throw new ReportedError(message);
  }
};
