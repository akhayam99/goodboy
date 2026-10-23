import type { AgentId, MountId, SessionEventId, SessionId } from '@goodboy/types';
import { readRebasePlan } from '../../../features/history/historyEngine';
import { rebaseConflictOf } from '../../../features/history/rebaseConflictOf';
import { scopedKindRouting } from '../agents/scopedKindRouting';
import { historyTargetOf } from '../history/historyTargetOf';
import { selectRebaseStop } from '../history/selectRebaseStop';
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
  readonly eventId: SessionEventId | null;
  readonly branch: RebaseAutoBranch;
};

type MarkParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly asked: ReadonlyArray<Asked>;
  readonly agentId: AgentId;
};

const markHanded = ({ set, sessionId, asked, agentId }: MarkParams): void => {
  set((state) => {
    const next = { ...state.historyRuns };
    let isChanged = false;
    for (const { mountId, run, eventId, branch } of asked) {
      const current = next[mountId];
      const isStillOpen =
        eventId !== null &&
        current === undefined &&
        selectRebaseStop({ state, sessionId, mountId })?.eventId === eventId;
      const base = isStillOpen ? run : current;
      if (base !== run || base.rebaseConflict === undefined) {
        continue;
      }
      next[mountId] = {
        ...base,
        rebaseConflict: {
          ...base.rebaseConflict,
          ontoRef: branch.ontoRef,
          head: branch.head,
          autoAgentId: agentId,
        },
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
    const found = await Promise.all(
      mountIds.map(async (mountId): Promise<ReadonlyArray<Asked>> => {
        const stop = selectRebaseStop({ state: get(), sessionId, mountId });
        const conflict = rebaseConflictOf({ run: stop?.run });
        if (stop === null || conflict === null || conflict.autoAgentId !== null) {
          return [];
        }
        const target = historyTargetOf({ get, sessionId, mountId });
        const plan =
          conflict.ontoRef === null || conflict.head === null
            ? await readRebasePlan({
                worktreePath: target.worktreePath,
                baseBranch: target.baseBranch,
                fetches: true,
              })
            : { ontoRef: conflict.ontoRef, head: conflict.head };
        return [
          {
            mountId,
            run: stop.run,
            eventId: stop.isRebuilt ? stop.eventId : null,
            branch: {
              projectName: target.projectName,
              branch: target.branch,
              worktreePath: target.worktreePath,
              ontoRef: plan.ontoRef,
              head: plan.head,
              files: conflict.files,
            },
          },
        ];
      }),
    );
    const asked = found.flat();
    const state = get();
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
      markHanded({ set, sessionId, asked, agentId: holder.agentId });
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
