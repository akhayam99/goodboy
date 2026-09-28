import { formatError } from '@goodboy/ui';
import type { HistoryPlanArgs, HistoryTrialResult } from '@goodboy/types';
import { runHistoryPlan } from '../../../features/history/historyEngine';
import { deriveHistoryEdits, afterCount } from '../../../features/history/historyEdits';
import {
  commitCount,
  historyEditAction,
  historyEditText,
  quoted,
} from '../../../features/history/historyEditText';
import { historyGraphModel } from '../../../features/history/historyGraphModel';
import { historyTargetOf } from './historyTargetOf';
import { identityOf } from './historyIdentity';
import { reportHistoryStop } from './reportHistoryStop';
import { setHistoryRun } from './setHistoryRun';
import type {
  ApplyHistoryDraftInput,
  ApplyHistoryRewriteOutcome,
  GetFn,
  HistoryApplied,
  HistoryDraft,
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
    onto: draft.onto,
  };
};

const UNTOUCHED = 'The temporary copy was removed. Your branch is exactly as it was.';

type SummaryParams = {
  readonly draft: HistoryDraft;
  readonly trial: HistoryTrialResult;
  readonly prHeadSha: string | null;
};

const appliedSummary = ({ draft, trial, prHeadSha }: SummaryParams): HistoryApplied => {
  const original = [...draft.commits].reverse().map((commit) => commit.sha);
  const titles = new Map(draft.commits.map((commit) => [commit.sha, commit.subject]));
  const titleOf = (sha: string): string => titles.get(sha) ?? sha.slice(0, 7);
  const edits = deriveHistoryEdits({
    items: draft.items,
    original,
    onto: draft.onto,
    behind: draft.graph?.behind ?? 0,
  });
  const includes: Record<string, string[]> = {};
  const owner = new Map<string, string>();
  for (const moved of trial.map) {
    if (moved.to === null) {
      continue;
    }
    const first = owner.get(moved.to);
    if (first === undefined) {
      owner.set(moved.to, moved.from);
      continue;
    }
    includes[moved.to] = [...(includes[moved.to] ?? []), titleOf(moved.from)];
  }
  const model = historyGraphModel({
    commits: draft.commits,
    items: draft.items,
    original,
    onto: draft.onto,
    graph: draft.graph,
    prHeadSha,
  });
  return {
    before: draft.commits.length,
    after: afterCount({ items: draft.items }),
    lines: edits.map((edit) => ({
      action: historyEditAction({ edit }),
      text: historyEditText({ edit, titleOf }),
    })),
    includes,
    newShas: [...new Set(trial.map.flatMap((moved) => (moved.to === null ? [] : [moved.to])))],
    touchedOnline: model.touchedOnline,
    isSameCode: trial.isTreeEqual,
    isOnMain: draft.onto !== null,
    removedFiles: trial.check?.removedFiles ?? [],
  };
};

const stopOfTrial = ({
  trial,
  draft,
}: {
  readonly trial: HistoryTrialResult;
  readonly draft: HistoryDraft;
}): HistoryStop | null => {
  const stop = trial.stop;
  if (stop !== null) {
    const title = draft.commits.find((commit) => commit.sha === stop.sha)?.subject ?? stop.sha;
    const where = `Step ${stop.index + 1} of ${draft.items.length}, ${quoted({ text: title })}`;
    return {
      reason: stop.kind === 'hook' ? 'hook' : 'conflict',
      message:
        stop.kind === 'hook'
          ? `${where}, was stopped by a hook: ${stop.message} ${UNTOUCHED}`
          : `${where}, conflicts in ${stop.files.join(', ')}. ${UNTOUCHED}`,
      files: stop.files,
      sha: stop.sha,
    };
  }
  const check = trial.check;
  if (trial.head === null || check === null) {
    return {
      reason: 'failed',
      message: `The trial did not produce a result. ${UNTOUCHED}`,
      files: [],
      sha: null,
    };
  }
  if (!check.isPassed) {
    return {
      reason: 'unverified',
      message: `The result on the copy did not match the plan: ${check.problems.join(' ')} ${UNTOUCHED}`,
      files: check.unexpectedFiles,
      sha: null,
    };
  }
  return null;
};

export const applyHistoryDraft = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    shouldPush,
  }: ApplyHistoryDraftInput): Promise<ApplyHistoryRewriteOutcome> => {
    const plan = draftPlanArgs({ get, sessionId, mountId });
    const draft = get().historyDrafts[mountId];
    const planId = draft?.planId ?? null;
    if (plan === null || draft === undefined) {
      return 'stopped';
    }
    const origin = 'plan' as const;
    const target = historyTargetOf({ get, sessionId, mountId });
    const identity = identityOf({ target });
    const stopWith = async (stop: HistoryStop): Promise<ApplyHistoryRewriteOutcome> => {
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: { phase: 'stopped', stop, planId, progress: null },
      });
      await reportHistoryStop({ get, set, target, origin, stop, planId });
      return 'stopped';
    };
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: {
        phase: 'trying',
        planId,
        stop: null,
        result: null,
        agentId: null,
        applied: null,
        backupRef: null,
        progress: { stage: 'copy' },
      },
    });
    const outcome = await runHistoryPlan({
      plan,
      branch: target.branch,
      onProgress: (progress) => {
        setHistoryRun({ set, sessionId, mountId, origin, patch: { progress } });
      },
    }).catch((error: unknown) => formatError(error));
    if (typeof outcome === 'string') {
      return stopWith({
        reason: 'failed',
        message: `${outcome} ${UNTOUCHED}`,
        files: [],
        sha: null,
      });
    }
    if (outcome.kind === 'blocked') {
      return stopWith({ reason: 'blocked', message: outcome.reason, files: [], sha: null });
    }
    const trial = outcome.result;
    const stop = stopOfTrial({ trial, draft });
    if (stop !== null || trial.head === null) {
      return stopWith(stop ?? { reason: 'failed', message: UNTOUCHED, files: [], sha: null });
    }
    const prHeadSha = get().mountGithub[mountId]?.pr?.headSha ?? null;
    const applied = appliedSummary({ draft, trial, prHeadSha });
    setHistoryRun({ set, sessionId, mountId, origin, patch: { progress: null, applied } });
    const result = await get().applyHistoryRewrite({
      sessionId,
      mountId,
      origin,
      planId,
      newHead: trial.head,
      expectedHead: plan.head,
      map: trial.map,
      shouldPush,
      byAgent: false,
      identity,
      isTreeEqual: trial.isTreeEqual,
      summary: `${applied.lines.length} ${applied.lines.length === 1 ? 'change' : 'changes'} · ${commitCount({ count: applied.before })} became ${applied.after}`,
    });
    if (result === 'stopped' && get().historyRuns[mountId]?.backupRef === null) {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { applied: null } });
    }
    await get().loadHistoryDraft({ sessionId, mountId });
    return result;
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
      identity: run.result.identity,
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

export const dismissHistoryRun = (set: SetFn, _get: GetFn) => {
  return ({ mountId }: HistoryMountInput): void => {
    set((state) => {
      if (state.historyRuns[mountId] === undefined) {
        return state;
      }
      const { [mountId]: _dropped, ...rest } = state.historyRuns;
      return { historyRuns: rest };
    });
  };
};
