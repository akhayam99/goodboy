import type { SessionId } from '@goodboy/types';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';

const POLL_MS = 2000;

type Poll = {
  readonly loads: Set<() => void>;
  readonly stop: () => void;
};

const polls = new Map<SessionId, Poll>();

type StartParams = {
  readonly sessionId: SessionId;
  readonly load: () => void;
};

export const startSharedPoll = ({ sessionId, load }: StartParams): (() => void) => {
  const loads = polls.get(sessionId)?.loads ?? new Set<() => void>();
  if (!polls.has(sessionId)) {
    polls.set(sessionId, {
      loads,
      stop: startPoll({
        run: () => {
          const [first] = loads;
          first?.();
        },
        everyMs: POLL_MS,
        gate: 'visible',
        isImmediate: false,
      }),
    });
  }
  loads.add(load);
  return () => {
    loads.delete(load);
    const poll = polls.get(sessionId);
    if (loads.size === 0 && poll !== undefined) {
      poll.stop();
      polls.delete(sessionId);
    }
  };
};
