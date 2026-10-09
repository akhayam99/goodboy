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
  run: () => Promise<void>;
}>;

export const runPortWrite = async ({
  get,
  sessionId,
  workspaceId,
  title,
  isQuiet = false,
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
      });
    }
    throw new ReportedError(message);
  }
};
