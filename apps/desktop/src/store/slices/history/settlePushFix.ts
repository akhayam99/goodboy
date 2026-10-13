import type { AgentId, SessionId } from '@goodboy/types';
import { setHistoryRun } from './setHistoryRun';
import type { SliceDeps } from '../../slice-types';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly hasFailed: boolean;
};

export const settlePushFix = ({ set, get }: SliceDeps) => {
  return async ({ sessionId, agentId, hasFailed }: Params): Promise<void> => {
    const run = Object.values(get().historyRuns).find(
      (candidate) => candidate.sessionId === sessionId && candidate.pushFix?.agentId === agentId,
    );
    if (run === undefined) {
      return;
    }
    const { mountId, origin } = run;
    setHistoryRun({ set, sessionId, mountId, origin, patch: { pushFix: undefined } });
    if (hasFailed) {
      return;
    }
    await get().pushHistoryRewrite({
      sessionId,
      mountId,
      origin,
      planId: run.planId,
      expectedRemoteSha: run.remoteSha,
      identity: run.identity,
    });
  };
};
