import { useCallback, useState } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { currentChecksRerunPort } from '../../checksRerunPort';

const FAILED_TITLE = "Couldn't run the checks again";

type RerunParams = {
  readonly delegationId: string;
  readonly sessionId: SessionId;
};

export type ChecksRerunModel = Readonly<{
  runningId: string | null;
  rerun: (params: RerunParams) => Promise<void>;
}>;

export const useChecksRerun = (): ChecksRerunModel => {
  const reportError = useAppStore((state) => state.reportError);
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const [runningId, setRunningId] = useState<string | null>(null);

  const rerun = useCallback(
    async ({ delegationId, sessionId }: RerunParams): Promise<void> => {
      const port = currentChecksRerunPort();
      if (port === null) {
        await reportError({
          title: FAILED_TITLE,
          error: new Error('Auto is not running yet. Try again in a moment.'),
        });
        return;
      }
      setRunningId(delegationId);
      try {
        const result = await port({ delegationId });
        if (result.kind === 'refused') {
          await reportError({ title: FAILED_TITLE, error: new Error(result.message) });
        }
        await loadAutoTrees({ sessionId });
      } catch (error) {
        await reportError({ title: FAILED_TITLE, error });
      } finally {
        setRunningId(null);
      }
    },
    [loadAutoTrees, reportError],
  );

  return { runningId, rerun };
};
