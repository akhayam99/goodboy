import { setResolveThreadVerdict } from '@goodboy/db';
import type { IsoDateTime, ResolveVerdict } from '@goodboy/types';
import { invokeAgentList, invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import {
  RECHECK_NOT_STARTED,
  RECHECK_NO_ANSWER,
  verdictFromTurn,
} from '../../../features/resolve/commentVerdict';
import { startRecheck } from '../../../features/resolve/startRecheck';
import { tauriDatabase } from '../../../shared/lib/db';
import type { ThreadRecheck } from './state';
import type { SliceParams, ThreadParams } from './types';

export type RecheckOutcome = 'settled' | 'started';

const recheckOf = ({
  get,
  sessionId,
  threadId,
}: SliceParams & ThreadParams): ThreadRecheck | null =>
  get().sessionThreadRechecks[sessionId]?.[threadId] ?? null;

const putRecheck = ({
  set,
  sessionId,
  threadId,
  recheck,
}: Pick<SliceParams, 'set'> & ThreadParams & { readonly recheck: ThreadRecheck | null }): void =>
  set((state) => {
    const { [threadId]: _dropped, ...rest } = state.sessionThreadRechecks[sessionId] ?? {};
    return {
      sessionThreadRechecks: {
        ...state.sessionThreadRechecks,
        [sessionId]: recheck === null ? rest : { ...rest, [threadId]: recheck },
      },
    };
  });

const putVerdict = async ({
  set,
  sessionId,
  threadId,
  verdict,
}: Pick<SliceParams, 'set'> &
  ThreadParams & { readonly verdict: ResolveVerdict | null }): Promise<void> => {
  await setResolveThreadVerdict({ db: tauriDatabase, sessionId, threadId, verdict });
  set((state) => {
    const facts = state.sessionThreadGit[sessionId]?.[threadId];
    if (facts === undefined) {
      return {};
    }
    return {
      sessionThreadGit: {
        ...state.sessionThreadGit,
        [sessionId]: { ...state.sessionThreadGit[sessionId], [threadId]: { ...facts, verdict } },
      },
    };
  });
};

export const recheckThread = async ({
  set,
  get,
  sessionId,
  threadId,
}: SliceParams & ThreadParams): Promise<RecheckOutcome> => {
  const current = recheckOf({ set, get, sessionId, threadId });
  if (current !== null && current.error === null) {
    return 'started';
  }
  putRecheck({ set, sessionId, threadId, recheck: { agentId: null, error: null } });
  try {
    await putVerdict({ set, sessionId, threadId, verdict: null });
    await get().refreshThreadGitState({ sessionId });
    const facts = get().sessionThreadGit[sessionId]?.[threadId];
    if (facts === undefined || facts.gitState !== 'missing') {
      putRecheck({ set, sessionId, threadId, recheck: null });
      return 'settled';
    }
    const agentIds = await startRecheck({ getState: get, sessionId, threadId });
    const agentId = agentIds[0] ?? null;
    if (agentId === null) {
      putRecheck({
        set,
        sessionId,
        threadId,
        recheck: { agentId: null, error: RECHECK_NOT_STARTED },
      });
      return 'settled';
    }
    putRecheck({ set, sessionId, threadId, recheck: { agentId, error: null } });
    return 'started';
  } catch (error) {
    putRecheck({
      set,
      sessionId,
      threadId,
      recheck: { agentId: null, error: RECHECK_NOT_STARTED },
    });
    throw error;
  }
};

type SettleParams = SliceParams & {
  readonly sessionId: ThreadParams['sessionId'];
  readonly agentId: NonNullable<ThreadRecheck['agentId']>;
  readonly assistantText: string;
  readonly didAgentDie?: boolean;
};

export const settleThreadRecheck = async ({
  set,
  get,
  sessionId,
  agentId,
  assistantText,
  didAgentDie = false,
}: SettleParams): Promise<void> => {
  const agent = (get().sessionPhaseRuns[sessionId] ?? []).find((run) => run.id === agentId);
  const threadId = agent?.sourceThreadIds?.[0] ?? agent?.sourceThreadId;
  if (threadId === undefined) {
    return;
  }
  const verdict = didAgentDie
    ? null
    : verdictFromTurn({ assistantText, threadId, now: Date.now() });
  await invokeAgentUpdateStatus(agentId, {
    status: verdict === null ? 'failed' : 'completed',
    outputSummary: verdict === null ? RECHECK_NO_ANSWER : verdict.evidence,
    completedAt: new Date().toISOString() as IsoDateTime,
  });
  const refreshed = await invokeAgentList(sessionId);
  set((state) => ({
    sessionPhaseRuns: { ...state.sessionPhaseRuns, [sessionId]: refreshed },
  }));
  if (verdict === null) {
    putRecheck({ set, sessionId, threadId, recheck: { agentId: null, error: RECHECK_NO_ANSWER } });
    return;
  }
  await putVerdict({ set, sessionId, threadId, verdict });
  putRecheck({ set, sessionId, threadId, recheck: null });
};
