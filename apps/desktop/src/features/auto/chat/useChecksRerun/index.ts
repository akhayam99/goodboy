import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { currentChecksRerunPort, type ChecksRerunPort } from '../../checksRerunPort';
import { AUTO_STARTING_SENTENCE } from '../../autoStartingSentence';
import { useBusyAct } from '../../hooks/useBusyAct';

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
  const { busyIds, run } = useBusyAct<ChecksRerunPort>({
    title: FAILED_TITLE,
    notReadyMessage: AUTO_STARTING_SENTENCE,
    currentPort: currentChecksRerunPort,
  });

  const rerun = useCallback(
    ({ delegationId, sessionId }: RerunParams): Promise<void> =>
      run({
        busyIds: [delegationId],
        work: async ({ port }) => {
          const result = await port({ delegationId });
          if (result.kind === 'refused') {
            await reportError({ title: FAILED_TITLE, error: new Error(result.message) });
          }
          await loadAutoTrees({ sessionId });
        },
      }),
    [loadAutoTrees, reportError, run],
  );

  return { runningId: busyIds[0] ?? null, rerun };
};
