import type { SessionId } from '@goodboy/types';
import { startPoll } from '../../../shared/lib/usePoll/startPoll';

const POLL_MS = 2000;
const HIDDEN_EVERY_TICKS = 5;

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
    let hiddenTicks = 0;
    polls.set(sessionId, {
      loads,
      stop: startPoll({
        run: () => {
          if (document.visibilityState !== 'visible') {
            hiddenTicks += 1;
            if (hiddenTicks < HIDDEN_EVERY_TICKS) {
              return;
            }
          }
          hiddenTicks = 0;
          const [first] = loads;
          first?.();
        },
        everyMs: POLL_MS,
        gate: 'always',
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
