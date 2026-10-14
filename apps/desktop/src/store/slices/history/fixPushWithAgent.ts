import { pushFixBrief } from '../../../features/history/pushFixBrief';
import { pushFixCommand } from '../../../features/history/pushFixCommand';
import { identityChange, identityOf } from './historyIdentity';
import { historyTargetOf } from './historyTargetOf';
import { spawnPushFixer } from './spawnPushFixer';
import { pushFixInFlight } from './pushFixInFlight';
import { setHistoryRun } from './setHistoryRun';
import type { SliceDeps } from '../../slice-types';
import type { HistoryMountInput } from './types';

type Params = HistoryMountInput & {
  readonly hint?: string;
  readonly onAccepted?: () => void;
};

export const fixPushWithAgent = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, mountId, hint, onAccepted }: Params): Promise<void> => {
    const run = get().historyRuns[mountId];
    if (
      run === undefined ||
      run.sessionId !== sessionId ||
      run.phase !== 'stopped' ||
      run.stop?.reason !== 'push-failed' ||
      run.pushFix !== undefined
    ) {
      return;
    }
    const key = `run:${mountId}`;
    if (!pushFixInFlight.claim({ key })) {
      return;
    }
    try {
      const target = historyTargetOf({ get, sessionId, mountId });
      const identity = identityOf({ target });
      await spawnPushFixer({
        get,
        sessionId,
        mountId,
        prompt: pushFixBrief({
          branch: target.branch,
          command: pushFixCommand({ branch: target.branch, remoteSha: run.remoteSha }),
          output: run.stop.message,
          ...(hint !== undefined && { hint }),
        }),
        ...(onAccepted !== undefined && { onAccepted }),
        isStillValid: () =>
          get().historyRuns[mountId] === run &&
          identityChange({ get, sessionId, mountId, identity }) === null,
        bind: ({ agentId }) => {
          setHistoryRun({
            set,
            sessionId,
            mountId,
            origin: run.origin,
            patch: { pushFix: { agentId } },
          });
        },
        unbind: ({ agentId }) => {
          if (get().historyRuns[mountId]?.pushFix?.agentId !== agentId) {
            return;
          }
          setHistoryRun({
            set,
            sessionId,
            mountId,
            origin: run.origin,
            patch: { pushFix: undefined },
          });
        },
      });
    } finally {
      pushFixInFlight.release({ key });
    }
  };
};
