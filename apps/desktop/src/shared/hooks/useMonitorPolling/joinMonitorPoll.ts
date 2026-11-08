import { startPoll } from '../../lib/usePoll/startPoll';

type Params = {
  readonly run: () => void;
  readonly everyMs: number;
};

let members = 0;
let stop: (() => void) | null = null;

export const joinMonitorPoll = ({ run, everyMs }: Params): (() => void) => {
  members += 1;
  if (members === 1) {
    stop = startPoll({ run, everyMs, gate: 'focused', isImmediate: false });
  }
  let hasLeft = false;
  return () => {
    if (hasLeft) {
      return;
    }
    hasLeft = true;
    members -= 1;
    if (members === 0 && stop !== null) {
      stop();
      stop = null;
    }
  };
};
