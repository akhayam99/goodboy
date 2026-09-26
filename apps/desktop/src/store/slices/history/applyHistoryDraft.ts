import { formatError } from '@goodboy/ui';
import type { HistoryPlanArgs } from '@goodboy/types';
import { tryHistoryPlan } from '../../../features/history/historyEngine';
import { historyTargetOf } from './historyTargetOf';
import { reportHistoryStop } from './reportHistoryStop';
import { setHistoryRun } from './setHistoryRun';
import type {
  ApplyHistoryDraftInput,
  ApplyHistoryRewriteOutcome,
  GetFn,
  HistoryMountInput,
  HistoryStop,
  SetFn,
} from './types';

type PlanOfParams = HistoryMountInput & {
  readonly get: GetFn;
};

export const draftPlanArgs = ({
  get,
  sessionId,
  mountId,
}: PlanOfParams): HistoryPlanArgs | null => {
  const draft = get().historyDrafts[mountId];
  if (draft === undefined || draft.sessionId !== sessionId || draft.commits.length === 0) {
    return null;
  }
  return {
    worktreePath: historyTargetOf({ get, sessionId, mountId }).worktreePath,
    base: draft.baseSha,
    head: draft.headSha,
    steps: draft.items,
  };
};

export const applyHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    shouldPush,
  }: ApplyHistoryDraftInput): Promise<ApplyHistoryRewriteOutcome> => {
    const plan = draftPlanArgs({ get, sessionId, mountId });
    const planId = get().historyDrafts[mountId]?.planId ?? null;
    if (plan === null) {
      return 'stopped';
    }
    const origin = 'plan' as const;
    const target = historyTargetOf({ get, sessionId, mountId });
    const stopWith = async (stop: HistoryStop): Promise<ApplyHistoryRewriteOutcome> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop, planId } });
      await reportHistoryStop({ get, set, target, origin, stop, planId });
      return 'stopped';
    };
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: { phase: 'trying', planId, stop: null, result: null, agentId: null },
    });
    const trial = await tryHistoryPlan(plan).catch((error: unknown) => formatError(error));
    if (typeof trial === 'string') {
      return stopWith({ reason: 'failed', message: trial, files: [], sha: null });
    }
    if (trial.stop !== null || trial.head === null) {
      return stopWith({
        reason: trial.stop?.kind === 'hook' ? 'hook' : 'conflict',
        message:
          trial.stop?.kind === 'hook'
            ? `A hook stopped the copy: ${trial.stop.message}`
            : 'The plan conflicts in the copy. Your branch was not touched.',
        files: trial.stop?.files ?? [],
        sha: trial.stop?.sha ?? null,
      });
    }
    const outcome = await get().applyHistoryRewrite({
      sessionId,
      mountId,
      origin,
      planId,
      newHead: trial.head,
      expectedHead: plan.head,
      map: trial.map,
      shouldPush,
      byAgent: false,
    });
    await get().loadHistoryDraft({ sessionId, mountId });
    return outcome;
  };
};

export const applyRewrittenHistory = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    shouldPush,
  }: ApplyHistoryDraftInput): Promise<ApplyHistoryRewriteOutcome> => {
    const run = get().historyRuns[mountId];
    if (run === undefined || run.result === null || run.sessionId !== sessionId) {
      return 'stopped';
    }
    const outcome = await get().applyHistoryRewrite({
      sessionId,
      mountId,
      origin: run.origin,
      planId: run.planId,
      newHead: run.result.head,
      expectedHead: run.result.expectedHead,
      map: run.result.map,
      shouldPush,
      byAgent: run.result.byAgent,
    });
    setHistoryRun({ set, sessionId, mountId, origin: run.origin, patch: { result: null } });
    await get().loadHistoryDraft({ sessionId, mountId });
    return outcome;
  };
};

export const rewriteDraftWithAgent = (_set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    note,
  }: HistoryMountInput & { readonly note?: string }): Promise<void> => {
    const plan = draftPlanArgs({ get, sessionId, mountId });
    if (plan === null) {
      return;
    }
    await get().startHistoryRewriter({
      sessionId,
      mountId,
      plan,
      origin: 'plan',
      planId: get().historyDrafts[mountId]?.planId ?? null,
      ...(note !== undefined && { note }),
    });
  };
};
