import { applyLiveHistoryEdit } from '../../../features/history/applyLiveHistoryEdit';
import { restoreHistoryBackup } from '../../../features/history/historyEngine';
import type { HistoryLiveOutcome } from '../../../features/history/historyLiveTypes';
import type { HistoryLiveRequest } from './types';

type Params = {
  readonly request: HistoryLiveRequest;
  readonly shouldStash: boolean;
};

export const readLiveHistoryOutcome = async ({
  request,
  shouldStash,
}: Params): Promise<HistoryLiveOutcome> => {
  if (request.plan !== null) {
    return applyLiveHistoryEdit({
      plan: request.plan,
      branch: request.identity.branch,
      shouldStash,
    });
  }
  if (request.entry === null) {
    return { kind: 'blocked', reason: 'There is nothing to restore.' };
  }
  const outcome = await restoreHistoryBackup({
    isLive: true,
    worktreePath: request.identity.worktreePath,
    branch: request.identity.branch,
    expectedHead: request.expectedHead,
    backupRef: request.entry.backupRef,
    shouldStash,
  });
  return { kind: 'finished', outcome, map: [] };
};
