import { extractHistoryReport } from '@goodboy/core';
import { formatError } from '@goodboy/ui';
import { collectHistoryRewrite } from '../../../features/history/historyEngine';
import { historyTargetOf } from './historyTargetOf';
import { reportHistoryStop } from './reportHistoryStop';
import { setHistoryRun } from './setHistoryRun';
import type { GetFn, HistoryStop, SetFn, SettleHistoryRewriterInput } from './types';

export const settleHistoryRewriter = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    agentId,
    assistantText,
    hasFailed,
  }: SettleHistoryRewriterInput): Promise<void> => {
    const binding = get().historyRewriters[agentId];
    if (binding === undefined || binding.sessionId !== sessionId) {
      return;
    }
    const { mountId, origin, planId, plan, copyPath, identity } = binding;
    const target = historyTargetOf({ get, sessionId, mountId });
    const stopWith = async (stop: HistoryStop): Promise<void> => {
      setHistoryRun({ set, sessionId, mountId, origin, patch: { phase: 'stopped', stop, planId } });
      await reportHistoryStop({ get, set, target, origin, stop, planId });
    };
    const report = extractHistoryReport(assistantText);
    if (report.stuck !== null) {
      await stopWith({
        reason: 'stuck',
        message: report.stuck.reason === '' ? 'History rewriter needs you.' : report.stuck.reason,
        files: report.stuck.files,
        sha: report.stuck.from === '' ? null : report.stuck.from,
      });
      return;
    }
    if (hasFailed || report.doneHead === null) {
      await stopWith({
        reason: hasFailed ? 'failed' : 'stuck',
        message: hasFailed
          ? 'History rewriter stopped before it finished the plan.'
          : 'History rewriter ended without finishing the plan.',
        files: [],
        sha: null,
      });
      return;
    }
    setHistoryRun({ set, sessionId, mountId, origin, patch: { progress: { stage: 'check' } } });
    const check = await collectHistoryRewrite({
      plan,
      copyPath,
      skipped: report.steps.filter((step) => step.to === null).map((step) => step.from),
      keepsCopy: false,
    }).catch((error: unknown) => formatError(error));
    if (typeof check === 'string') {
      await stopWith({ reason: 'invalid', message: check, files: [], sha: null });
      return;
    }
    if (check.head === null) {
      await stopWith({
        reason: 'invalid',
        message: check.problems.join(' '),
        files: [],
        sha: null,
      });
      return;
    }
    set((state) => {
      const next = { ...state.historyRewriters };
      delete next[agentId];
      return { historyRewriters: next };
    });
    if (origin === 'rebase') {
      await get().applyHistoryRewrite({
        sessionId,
        mountId,
        origin,
        planId,
        newHead: check.head,
        expectedHead: plan.head,
        map: check.map,
        shouldPush: true,
        byAgent: true,
        identity,
      });
      return;
    }
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: {
        phase: 'rewritten',
        copyPath: null,
        stop: null,
        result: {
          head: check.head,
          expectedHead: plan.head,
          map: check.map,
          isTreeEqual: check.isTreeEqual,
          changedFiles: check.changedFiles,
          byAgent: true,
          identity,
        },
      },
    });
  };
};
