import { setResolveCandidateState } from '@goodboy/db';
import { tauriDatabase } from '../../../../shared/lib/db';
import { loadResolveCandidatesInto } from '../loadResolveCandidatesInto';
import type { RetryLaneParams, SliceParams } from '../types';

type Params = SliceParams & Pick<RetryLaneParams, 'sessionId' | 'worktreePath'>;

export const restoreLaneRebuild = async ({
  set,
  get,
  sessionId,
  worktreePath,
}: Params): Promise<void> => {
  const failure = (get().sessionLaneRebuildFailures[sessionId] ?? []).find(
    (entry) => entry.worktreePath === worktreePath,
  );
  if (failure === undefined) {
    return;
  }
  for (const candidateId of failure.candidateIds) {
    await setResolveCandidateState({ db: tauriDatabase, candidateId, state: 'ready' });
  }
  set((state) => ({
    sessionLaneRebuildFailures: {
      ...state.sessionLaneRebuildFailures,
      [sessionId]: (state.sessionLaneRebuildFailures[sessionId] ?? []).filter(
        (entry) => entry.worktreePath !== worktreePath,
      ),
    },
  }));
  await loadResolveCandidatesInto({ set, sessionId });
};
