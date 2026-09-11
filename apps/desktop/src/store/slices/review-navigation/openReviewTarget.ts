import { formatError } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { selectActiveMountId } from '../project-mounts/selectors';
import type {
  GetFn,
  OpenReviewTargetParams,
  ReviewTarget,
  ReviewTargetOutcome,
  ReviewTargetReason,
  SetFn,
} from './types';

type Params = { readonly set: SetFn; readonly get: GetFn } & OpenReviewTargetParams;

type WriteParams = {
  readonly set: SetFn;
  readonly sessionId: SessionId;
  readonly target: ReviewTarget | null;
};

const writeTarget = ({ set, sessionId, target }: WriteParams): void => {
  set((state) => ({ reviewTargets: { ...state.reviewTargets, [sessionId]: target } }));
};

const unavailable = (reason: ReviewTargetReason): ReviewTargetOutcome => ({
  kind: 'unavailable',
  reason,
});

export const openReviewTarget = async ({
  set,
  get,
  sessionId,
  mountId,
  prNumber,
  threadId,
  mode,
}: Params): Promise<ReviewTargetOutcome> => {
  if (!get().sessions.some((candidate) => candidate.id === sessionId)) {
    return unavailable('no_session');
  }
  const isTargeted = prNumber !== undefined || threadId !== undefined;
  if (mountId !== undefined) {
    try {
      await get().setSessionActiveMount({ sessionId, mountId });
    } catch (error) {
      return { kind: 'failed', error: formatError(error) };
    }
  }
  const activeMountId: MountId | null = mountId ?? selectActiveMountId({ state: get(), sessionId });
  if (isTargeted && activeMountId === null) {
    return unavailable('no_mount');
  }
  const requestId = crypto.randomUUID();
  const base = {
    requestId,
    threadId: threadId ?? null,
    mode: mode ?? null,
    reason: null,
    error: null,
  };
  writeTarget({ set, sessionId, target: { ...base, status: 'pending' } });
  const isCurrent = (): boolean => get().reviewTargets[sessionId]?.requestId === requestId;

  const settle = (outcome: ReviewTargetOutcome): ReviewTargetOutcome => {
    if (!isCurrent()) {
      return unavailable('superseded');
    }
    const target: ReviewTarget =
      outcome.kind === 'opened'
        ? { ...base, status: 'ready' }
        : outcome.kind === 'unavailable'
          ? { ...base, status: 'unavailable', reason: outcome.reason }
          : { ...base, status: 'failed', error: outcome.error };
    writeTarget({ set, sessionId, target });
    get().setActiveLens(sessionId, 'review');
    return outcome;
  };

  if (!isTargeted) {
    return settle({ kind: 'opened' });
  }
  try {
    if (prNumber !== undefined && activeMountId !== null) {
      await get().selectSessionPr(sessionId, prNumber, activeMountId);
    }
    if (!isCurrent()) {
      return unavailable('superseded');
    }
    if (threadId !== undefined && activeMountId !== null) {
      await get().refreshSessionPrDetail(sessionId, { force: true, mountId: activeMountId });
    }
  } catch (error) {
    return settle({ kind: 'failed', error: formatError(error) });
  }
  if (!isCurrent()) {
    return unavailable('superseded');
  }
  const pr = get().sessionGithub[sessionId]?.pr ?? null;
  if (pr === null || (prNumber !== undefined && pr.number !== prNumber)) {
    return settle(unavailable('no_pull_request'));
  }
  if (threadId === undefined) {
    return settle({ kind: 'opened' });
  }
  try {
    await get().loadResolveSession({ sessionId });
    if (!isCurrent()) {
      return unavailable('superseded');
    }
    const materialized = await get().ensureReviewThread({
      sessionId,
      threadId,
      prNumber: pr.number,
    });
    if (materialized === 'missing') {
      return settle(unavailable('no_thread'));
    }
  } catch (error) {
    return settle({ kind: 'failed', error: formatError(error) });
  }
  return settle({ kind: 'opened' });
};
