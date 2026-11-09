import { formatError } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { ReportedError } from '../notifications/reportedError';
import { noFailureSurface } from './prWriteOptions';
import type { GetFn } from './types';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  workspaceId: WorkspaceId;
  title: string;
  isQuiet?: boolean;
  hasFailureSurface?: () => boolean;
  run: () => Promise<void>;
}>;

export const runPortWrite = async ({
  get,
  sessionId,
  workspaceId,
  title,
  isQuiet = false,
  hasFailureSurface = noFailureSurface,
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
        isRead: hasFailureSurface(),
      });
    }
    throw new ReportedError(message);
  }
};
