import { useAppStore } from '../../store';
import { startPoll } from '../../shared/lib/usePoll/startPoll';

const LINK_POLL_MS = 3_000;

let holders = 0;
let stopPoll: (() => void) | null = null;

export const retainCompanionLinkPoll = (): (() => void) => {
  holders += 1;
  if (stopPoll === null) {
    stopPoll = startPoll({
      run: () => {
        void useAppStore.getState().refreshCompanionLink();
      },
      everyMs: LINK_POLL_MS,
      gate: 'visible',
      isImmediate: true,
    });
  }
  let isReleased = false;
  return () => {
    if (isReleased) {
      return;
    }
    isReleased = true;
    holders -= 1;
    if (holders === 0 && stopPoll !== null) {
      stopPoll();
      stopPoll = null;
    }
  };
};
