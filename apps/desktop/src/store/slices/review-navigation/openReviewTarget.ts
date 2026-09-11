import { formatError } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { selectActiveMountId } from '../project-mounts/selectors';
import { REVIEW_HOME, reviewMountId, reviewPrNumber, reviewThreadId } from './destination';
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

type MountPrParams = {
  readonly get: GetFn;
  readonly mountId: MountId;
  readonly prNumber: number;
};

type DisplayedParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
};

const writeTarget = ({ set, sessionId, target }: WriteParams): void => {
  set((state) => ({ reviewTargets: { ...state.reviewTargets, [sessionId]: target } }));
};

const unavailable = (reason: ReviewTargetReason): ReviewTargetOutcome => ({
  kind: 'unavailable',
  reason,
});

const hasMountPr = ({ get, mountId, prNumber }: MountPrParams): boolean =>
  (get().mountGithub[mountId]?.prs ?? []).some((candidate) => candidate.number === prNumber);

const displayedPrNumber = ({ get, sessionId }: DisplayedParams): number | null =>
  get().sessionSelectedPrNumber[sessionId] ?? get().sessionGithub[sessionId]?.pr?.number ?? null;

export const openReviewTarget = async ({
  set,
  get,
  sessionId,
  destination = REVIEW_HOME,
  mode,
}: Params): Promise<ReviewTargetOutcome> => {
  if (!get().sessions.some((candidate) => candidate.id === sessionId)) {
    return unavailable('no_session');
  }
  const requestId = crypto.randomUUID();
  const base = {
    requestId,
    destination,
    mode: mode ?? null,
    reason: null,
    error: null,
  };
  writeTarget({ set, sessionId, target: { ...base, status: 'pending' } });
  const isCurrent = (): boolean => get().reviewTargets[sessionId]?.requestId === requestId;

  const release = (reason: ReviewTargetReason): ReviewTargetOutcome => {
    if (isCurrent()) {
      writeTarget({ set, sessionId, target: null });
    }
    return unavailable(reason);
  };

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

  const requestedMountId = reviewMountId({ destination });
  if (requestedMountId !== null) {
    try {
      await get().setSessionActiveMount({ sessionId, mountId: requestedMountId });
    } catch (error) {
      return settle({ kind: 'failed', error: formatError(error) });
    }
    if (!isCurrent()) {
      return unavailable('superseded');
    }
  }
  const prNumber = reviewPrNumber({ destination });
  if (prNumber === null) {
    return settle({ kind: 'opened' });
  }
  const mountId = requestedMountId ?? selectActiveMountId({ state: get(), sessionId });
  if (mountId === null) {
    return release('no_mount');
  }
  const threadId = reviewThreadId({ destination });
  try {
    if (!hasMountPr({ get, mountId, prNumber })) {
      await get().refreshSessionPr(sessionId, { force: true, mountId });
      if (!isCurrent()) {
        return unavailable('superseded');
      }
    }
    await get().selectSessionPr(sessionId, prNumber, mountId);
    if (!isCurrent()) {
      return unavailable('superseded');
    }
    if (threadId !== null) {
      await get().refreshSessionPrDetail(sessionId, { force: true, mountId });
    }
  } catch (error) {
    return settle({ kind: 'failed', error: formatError(error) });
  }
  if (!isCurrent()) {
    return unavailable('superseded');
  }
  if (displayedPrNumber({ get, sessionId }) !== prNumber) {
    return settle(unavailable('no_pull_request'));
  }
  if (threadId === null) {
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
      prNumber,
      isCancelled: () => !isCurrent(),
    });
    if (materialized === 'cancelled') {
      return unavailable('superseded');
    }
    if (materialized === 'missing') {
      return settle(unavailable('no_thread'));
    }
    if (materialized === 'closed') {
      return settle(unavailable('thread_closed'));
    }
  } catch (error) {
    return settle({ kind: 'failed', error: formatError(error) });
  }
  return settle({ kind: 'opened' });
};
