import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { isReportedError } from '../../../store/slices/notifications/reportedError';

export type PendingActionRun = {
  readonly key: string;
  readonly failureTitle: string;
  readonly task: () => Promise<unknown>;
};

type Params = {
  readonly sessionId?: SessionId | null;
  readonly workspaceId?: WorkspaceId | null;
};

export type PendingAction = {
  readonly pendingKeys: ReadonlySet<string>;
  readonly run: (params: PendingActionRun) => Promise<boolean>;
};

export const usePendingAction = ({
  sessionId = null,
  workspaceId = null,
}: Params = {}): PendingAction => {
  const reportError = useAppStore((state) => state.reportError);
  const inFlight = useRef(new Set<string>());
  const isMounted = useRef(true);
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const publish = useCallback(() => {
    if (!isMounted.current) {
      return;
    }
    setPendingKeys(new Set(inFlight.current));
  }, []);

  const run = useCallback(
    async ({ key, failureTitle, task }: PendingActionRun): Promise<boolean> => {
      if (inFlight.current.has(key)) {
        return false;
      }
      inFlight.current.add(key);
      publish();
      try {
        await task();
        return true;
      } catch (error) {
        if (!isReportedError(error)) {
          void reportError({
            title: failureTitle,
            error,
            ...(sessionId !== null && { sessionId }),
            ...(workspaceId !== null && { workspaceId }),
          }).catch(() => undefined);
        }
        return false;
      } finally {
        inFlight.current.delete(key);
        publish();
      }
    },
    [publish, reportError, sessionId, workspaceId],
  );

  return { pendingKeys, run };
};
