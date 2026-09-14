import type { MountId, SessionId } from '@goodboy/types';

export type MountContinuation = Readonly<{
  operationId: string;
  sessionId: SessionId;
  mountId: MountId;
  mountName: string;
  branch: string;
  worktreePath: string;
  origin: 'fork' | 'attach' | 'materialize';
}>;

export const MAX_MOUNT_CONTINUATIONS = 3;

export type MountContinuationRefusal = 'already-queued' | 'same-mount' | 'chain-exhausted';

export type MountContinuationOutcome =
  | { readonly queued: true }
  | { readonly queued: false; readonly refusal: MountContinuationRefusal };

const queued = new Map<string, MountContinuation>();
const consumed = new Set<string>();
const chained = new Map<SessionId, number>();

type QueueParams = {
  readonly continuation: MountContinuation;
  readonly boundMountId?: MountId | null;
};

export const queueMountContinuation = ({
  continuation,
  boundMountId,
}: QueueParams): MountContinuationOutcome => {
  if (queued.has(continuation.operationId) || consumed.has(continuation.operationId)) {
    return { queued: false, refusal: 'already-queued' };
  }
  if (boundMountId != null && boundMountId === continuation.mountId) {
    return { queued: false, refusal: 'same-mount' };
  }
  const continuationCount =
    (chained.get(continuation.sessionId) ?? 0) +
    pendingMountContinuations({ sessionId: continuation.sessionId }).length;
  if (continuationCount >= MAX_MOUNT_CONTINUATIONS) {
    return { queued: false, refusal: 'chain-exhausted' };
  }
  queued.set(continuation.operationId, continuation);
  return { queued: true };
};

export const mountContinuationRefusal = ({
  refusal,
}: {
  readonly refusal: MountContinuationRefusal;
}): string => {
  if (refusal === 'same-mount') {
    return 'this turn already runs in that mount, so no new turn was started';
  }
  if (refusal === 'chain-exhausted') {
    return `this session already chained ${MAX_MOUNT_CONTINUATIONS} mount turns: finish the work here or ask the operator, no new turn was started`;
  }
  return 'that mount request already started a turn, so no new turn was started';
};

export const resetMountContinuationChain = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): void => {
  chained.delete(sessionId);
};

export const pendingMountContinuations = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): ReadonlyArray<MountContinuation> =>
  Array.from(queued.values()).filter((entry) => entry.sessionId === sessionId);

export const takeMountContinuation = ({
  sessionId,
}: {
  readonly sessionId: SessionId;
}): MountContinuation | null => {
  const next = pendingMountContinuations({ sessionId })[0] ?? null;
  if (next === null) {
    return null;
  }
  queued.delete(next.operationId);
  consumed.add(next.operationId);
  chained.set(sessionId, (chained.get(sessionId) ?? 0) + 1);
  return next;
};

export const clearMountContinuations = (): void => {
  queued.clear();
  consumed.clear();
  chained.clear();
};

type PromptLinesParams = {
  readonly continuation: MountContinuation;
};

const mountContinuationPromptLines = ({
  continuation,
}: PromptLinesParams): ReadonlyArray<string> => {
  const location = `${continuation.mountName} (mount ${continuation.mountId}) on branch ${continuation.branch} at ${continuation.worktreePath}`;
  switch (continuation.origin) {
    case 'fork':
      return [
        `This turn starts in the mount you forked: ${location}.`,
        'The previous turn ran in another directory, so nothing it left uncommitted is here. Cherry-pick what belongs on this branch and resolve conflicts normally.',
        'Continue the work you declared when you asked for this mount.',
      ];
    case 'attach':
      return [
        `This turn starts in the mount you attached: ${location}.`,
        'The previous turn ran in another directory, so nothing it left uncommitted is here. Cherry-pick what belongs on this branch and resolve conflicts normally.',
        'Continue the work you declared when you asked for this mount.',
      ];
    case 'materialize':
      return [
        `The project mount you requested is ready: ${location}.`,
        'The previous turn ran in scratch space or another mount. Do the work declared in the materialization request now.',
      ];
    default: {
      const exhaustive: never = continuation.origin;
      return exhaustive;
    }
  }
};

export const mountContinuationPrompt = ({
  continuation,
}: {
  readonly continuation: MountContinuation;
}): string => mountContinuationPromptLines({ continuation }).join('\n');
