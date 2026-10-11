import type { AgentId, SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';
import { discardHistoryCopy, prepareHistoryRewrite } from '../../../features/history/historyEngine';
import { historyRewriterConfig } from './historyRewriterConfig';
import { historyTargetOf } from './historyTargetOf';
import { identityOf } from './historyIdentity';
import { reportHistoryStop } from './reportHistoryStop';
import { rewriterKickoff } from './rewriterKickoff';
import { setHistoryRun } from './setHistoryRun';
import type {
  ApplyHistoryRewriteOutcome,
  GetFn,
  HistoryStop,
  SetFn,
  StartHistoryRewriterInput,
} from './types';
import { sessionById } from '../sessions/sessionIndex';

const HISTORY_REWRITER_NAME = 'History rewriter';

export type StartHistoryRewriterOutcome = ApplyHistoryRewriteOutcome | 'rewriting' | 'rewritten';

export const startHistoryRewriter = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    mountId,
    plan,
    origin,
    planId,
    note,
  }: StartHistoryRewriterInput): Promise<StartHistoryRewriterOutcome> => {
    const target = historyTargetOf({ get, sessionId, mountId });
    const identity = identityOf({ target });
    const stopWith = async (stop: HistoryStop): Promise<StartHistoryRewriterOutcome> => {
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
    const prepared = await prepareHistoryRewrite({
      plan,
      slug: `${mountId}-${Date.now()}`,
    }).catch((error: unknown) => formatError(error));
    if (typeof prepared === 'string') {
      return stopWith({ reason: 'failed', message: prepared, files: [], sha: null });
    }
    if (prepared.stop === null && prepared.head !== null && prepared.check?.isPassed !== true) {
      return stopWith({
        reason: 'unverified',
        message: `The replay on the temporary copy did not match the plan: ${(prepared.check?.problems ?? ['it was not checked.']).join(' ')} Nothing was changed.`,
        files: prepared.check?.unexpectedFiles ?? [],
        sha: null,
      });
    }
    if (prepared.stop === null && prepared.head !== null) {
      if (origin === 'rebase') {
        return get().applyHistoryRewrite({
          sessionId,
          mountId,
          origin,
          planId,
          newHead: prepared.head,
          expectedHead: plan.head,
          map: prepared.map,
          shouldPush: true,
          byAgent: false,
          identity,
        });
      }
      setHistoryRun({
        set,
        sessionId,
        mountId,
        origin,
        patch: {
          phase: 'rewritten',
          result: {
            head: prepared.head,
            expectedHead: plan.head,
            map: prepared.map,
            isTreeEqual: prepared.isTreeEqual,
            changedFiles: prepared.changedFiles,
            byAgent: false,
            identity,
          },
        },
      });
      return 'rewritten';
    }
    if (prepared.stop === null || prepared.copyPath === null) {
      return stopWith({
        reason: 'failed',
        message: 'The copy for the rewrite could not be kept.',
        files: [],
        sha: null,
      });
    }
    const copyPath = prepared.copyPath;
    const discard = () =>
      discardHistoryCopy({ worktreePath: target.worktreePath, copyPath }).catch(() => undefined);
    const config = historyRewriterConfig({ state: get(), sessionId });
    if (config.provider === '') {
      await discard();
      return stopWith({
        reason: 'no-provider',
        message: 'No provider is connected to hand the conflict to History rewriter.',
        files: prepared.stop.files,
        sha: prepared.stop.sha,
      });
    }
    let agentId: AgentId;
    try {
      agentId = await get().spawnAgent(sessionId, {
        name: HISTORY_REWRITER_NAME,
        kindOverride: 'rewriter',
        model: config.model,
        provider: config.provider,
        effort: config.effort,
        focus: 'none',
      });
    } catch (error) {
      await discard();
      return stopWith({ reason: 'failed', message: formatError(error), files: [], sha: null });
    }
    set((state) => ({
      historyRewriters: {
        ...state.historyRewriters,
        [agentId]: { sessionId, mountId, copyPath, plan, origin, planId, identity },
      },
    }));
    setHistoryRun({
      set,
      sessionId,
      mountId,
      origin,
      patch: {
        phase: 'rewriting',
        agentId,
        copyPath,
        stop: {
          reason: prepared.stop.kind === 'hook' ? 'hook' : 'conflict',
          message: prepared.stop.message,
          files: prepared.stop.files,
          sha: prepared.stop.sha,
        },
      },
    });
    const kickoff = rewriterKickoff({
      branch: target.branch,
      base: plan.base,
      copyPath,
      order: prepared.order,
      stop: prepared.stop,
      ...(note !== undefined && { note }),
    });
    void get()
      .sendTurn({
        sessionId,
        agentId,
        content: kickoff,
        handoff: { sender: { kind: 'historyRewrite' }, instruction: kickoff, plan: null },
      })
      .catch(async (error: unknown) => {
        set((state) => {
          const { [agentId]: _dropped, ...rest } = state.historyRewriters;
          return { historyRewriters: rest };
        });
        await discard();
        return stopWith({ reason: 'failed', message: formatError(error), files: [], sha: null });
      });
    return 'rewriting';
  };
};
