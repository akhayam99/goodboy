import type { SessionId } from '@goodboy/types';
import { formatError } from '@goodboy/ui';

type Params = {
  readonly sessionId: SessionId;
  readonly run: () => Promise<unknown>;
};

type SessionParams = {
  readonly sessionId: SessionId;
};

const running = new Set<SessionId>();
const settled = new Set<SessionId>();
const rearmed = new Set<SessionId>();

export const runMountRecoveryOnce = ({ sessionId, run }: Params): void => {
  if (running.has(sessionId) || settled.has(sessionId)) {
    return;
  }
  running.add(sessionId);
  void Promise.resolve()
    .then(run)
    .then(
      () => {
        running.delete(sessionId);
        if (rearmed.delete(sessionId)) {
          return;
        }
        settled.add(sessionId);
      },
      (error: unknown) => {
        running.delete(sessionId);
        rearmed.delete(sessionId);
        console.error(
          `[mounts] operation recovery failed for session ${sessionId}`,
          formatError(error),
        );
      },
    );
};

export const rearmMountRecovery = ({ sessionId }: SessionParams): void => {
  settled.delete(sessionId);
  if (running.has(sessionId)) {
    rearmed.add(sessionId);
  }
};

export const resetMountRecoveryGuard = (): void => {
  running.clear();
  settled.clear();
  rearmed.clear();
};
