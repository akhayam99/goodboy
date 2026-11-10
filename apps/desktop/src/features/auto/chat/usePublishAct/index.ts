import { CHECK_STATE } from '../../../../store/slices/notifications/errorRecovery';
import { useCallback } from 'react';
import { publishOfResult, type ResultPublish } from '@goodboy/core/auto';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { currentPublishPort, type PublishAct, type PublishPort } from '../../publishPort';
import { AUTO_STARTING_SENTENCE } from '../../autoStartingSentence';
import { useBusyAct } from '../../hooks/useBusyAct';
import { isPublishOpenOf } from '../isPublishOpenOf';

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

type SavedParams = {
  readonly sessionId: SessionId;
  readonly delegationId: string;
};

const savedPublishOf = ({ sessionId, delegationId }: SavedParams): ResultPublish | null => {
  const views = useAppStore.getState().autoTreeViews[sessionId] ?? [];
  const delegation = views
    .flatMap((view) => view.delegations)
    .find((candidate) => candidate.id === delegationId);
  return delegation === undefined ? null : publishOfResult({ result: delegation.result });
};

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
          await loadAutoTrees({ sessionId });
          for (const row of result.rows) {
            if (row.state !== 'refused' || row.message === null) {
              continue;
            }
            const saved = savedPublishOf({ sessionId, delegationId: row.delegationId });
            if (row.isStorageFailure !== true && !isPublishOpenOf({ act: name, publish: saved })) {
              continue;
            }
            await reportError({
              recovery: CHECK_STATE,
              title: FAILED_TITLE,
              error: new Error(row.message),
            });
          }
        },
      }),
    [loadAutoTrees, reportError, run],
  );

  return { busyIds, act };
};
