import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { currentPublishPort, type PublishAct, type PublishPort } from '../../publishPort';
import { AUTO_STARTING_SENTENCE } from '../../autoStartingSentence';
import { useBusyAct } from '../useBusyAct';

const FAILED_TITLE = "Couldn't finish the push";

type ActParams = {
  readonly act: PublishAct;
  readonly delegationIds: ReadonlyArray<string>;
  readonly sessionId: SessionId;
};

export type PublishActModel = Readonly<{
  busyIds: ReadonlyArray<string>;
  act: (params: ActParams) => Promise<void>;
}>;

export const usePublishAct = (): PublishActModel => {
  const reportError = useAppStore((state) => state.reportError);
  const loadAutoTrees = useAppStore((state) => state.loadAutoTrees);
  const { busyIds, run } = useBusyAct<PublishPort>({
    title: FAILED_TITLE,
    notReadyMessage: AUTO_STARTING_SENTENCE,
    currentPort: currentPublishPort,
  });

  const act = useCallback(
    ({ act: name, delegationIds, sessionId }: ActParams): Promise<void> =>
      run({
        busyIds: delegationIds,
        work: async ({ port }) => {
          const result = await port({ act: name, delegationIds });
          for (const row of result.rows) {
            if ((row.state === 'failed' || row.state === 'refused') && row.message !== null) {
              await reportError({ title: FAILED_TITLE, error: new Error(row.message) });
            }
          }
          await loadAutoTrees({ sessionId });
        },
      }),
    [loadAutoTrees, reportError, run],
  );

  return { busyIds, act };
};
