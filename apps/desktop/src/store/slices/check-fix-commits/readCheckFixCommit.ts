import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { listBranchCommits } from '../../../features/worktree/worktree';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import { fixCommitOf } from './fixCommitOf';
import type { CheckFixCommit, GetFn, SetFn } from './types';

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly fixAgentId: AgentId;
};

type WriteParams = {
  readonly fixAgentId: AgentId;
  readonly fact: CheckFixCommit;
};

const latest = createLatestOnly();

export const readCheckFixCommit =
  ({ set, get }: Deps) =>
  async ({ sessionId, mountId, fixAgentId }: Params): Promise<void> => {
    const write = ({ fixAgentId: agentId, fact }: WriteParams) =>
      set((state) => ({ checkFixCommits: { ...state.checkFixCommits, [agentId]: fact } }));
    const fix = (get().sessionPhaseRuns[sessionId] ?? []).find((agent) => agent.id === fixAgentId);
    const repo = getSessionRepo({ get, sessionId, mountId });
    if (fix === undefined || fix.startedAt === undefined || repo === null) {
      write({ fixAgentId, fact: { kind: 'unreadable' } });
      return;
    }
    const startedAt = fix.startedAt;
    const isStillTheFix = () =>
      (get().sessionPhaseRuns[sessionId] ?? []).some(
        (agent) =>
          agent.id === fixAgentId && agent.startedAt === startedAt && agent.deletedAt === undefined,
      );
    try {
      await latest.run({
        key: fixAgentId,
        request: () => listBranchCommits(repo.worktreePath),
        apply: (commits) => {
          if (!isStillTheFix()) {
            return;
          }
          write({ fixAgentId, fact: fixCommitOf({ commits, startedAt }) });
        },
      });
    } catch {
      if (isStillTheFix()) {
        write({ fixAgentId, fact: { kind: 'unreadable' } });
      }
    }
  };
