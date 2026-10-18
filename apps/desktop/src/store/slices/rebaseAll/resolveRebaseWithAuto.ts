import type { AgentId, MountId } from '@goodboy/types';
import { rebaseConflictOf } from '../../../features/history/rebaseConflictOf';
import { scopedKindRouting } from '../agents/scopedKindRouting';
import { historyTargetOf } from '../history/historyTargetOf';
import type { HistoryRun } from '../history/types';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { rebaseAutoGoal, type RebaseAutoBranch, type TidyAutoBranch } from './rebaseAutoGoal';
import type {
  GetFn,
  ResolveRebaseWithAutoInput,
  ResolveRebaseWithAutoOutcome,
  SetFn,
} from './types';

const AUTO_NAME = 'Auto: rebase';

type Asked = {
  readonly mountId: MountId;
  readonly run: HistoryRun;
  readonly branch: RebaseAutoBranch;
};

type MarkParams = {
  readonly set: SetFn;
  readonly asked: ReadonlyArray<Asked>;
  readonly agentId: AgentId;
};

const markHanded = ({ set, asked, agentId }: MarkParams): void => {
  set((state) => {
    const next = { ...state.historyRuns };
    let isChanged = false;
    for (const { mountId, run } of asked) {
      const current = next[mountId];
      if (current !== run || current.rebaseConflict === undefined) {
        continue;
      }
      next[mountId] = {
        ...current,
        rebaseConflict: { ...current.rebaseConflict, autoAgentId: agentId },
        updatedAt: Date.now(),
      };
      isChanged = true;
    }
    return isChanged ? { historyRuns: next } : {};
  });
};

export const resolveRebaseWithAuto = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountIds,
    tidyMountIds = [],
    hint,
    onAccepted,
  }: ResolveRebaseWithAutoInput): Promise<ResolveRebaseWithAutoOutcome> => {
    const state = get();
    const asked = mountIds.flatMap((mountId): ReadonlyArray<Asked> => {
      const run = state.historyRuns[mountId];
      const conflict = rebaseConflictOf({ run });
      if (run === undefined || conflict === null || conflict.autoAgentId !== null) {
        return [];
      }
      const target = historyTargetOf({ get, sessionId, mountId });
      return [
        {
          mountId,
          run,
          branch: {
            projectName: target.projectName,
            branch: target.branch,
            worktreePath: target.worktreePath,
            ontoRef: conflict.ontoRef,
            head: conflict.head,
            files: conflict.files,
          },
        },
      ];
    });
    const tidy = tidyMountIds.map((mountId): TidyAutoBranch => {
      const target = historyTargetOf({ get, sessionId, mountId });
      return {
        projectName: target.projectName,
        branch: target.branch,
        worktreePath: target.worktreePath,
      };
    });
    if (asked.length === 0 && tidy.length === 0) {
      return { kind: 'nothing' };
    }
    const routing = scopedKindRouting({
      state,
      settings: selectResolvedSettings({ state, sessionId }),
      kind: 'auto',
    });
    const goal = rebaseAutoGoal({
      conflicts: asked.map((entry) => entry.branch),
      tidy,
      hint,
    });
    const holder: { agentId: AgentId | null; isAccepted: boolean } = {
      agentId: null,
      isAccepted: false,
    };
    const accept = (): void => {
      if (holder.agentId === null) {
        holder.isAccepted = true;
        return;
      }
      markHanded({ set, asked, agentId: holder.agentId });
      onAccepted?.({ agentId: holder.agentId });
    };
    const agentId = await get().spawnAgent(sessionId, {
      name: AUTO_NAME,
      kindOverride: 'auto',
      provider: routing.provider,
      model: routing.model,
      effort: routing.effort,
      initialPrompt: goal,
      focus: 'none',
      onKickoffAccepted: accept,
    });
    holder.agentId = agentId;
    if (holder.isAccepted) {
      accept();
    }
    return { kind: 'started', agentId };
  };
};
