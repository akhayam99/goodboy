import { NAMES } from '../../shared/utils/names';
import type { AutoChildState } from './autoGroupOf';

type Params = {
  readonly state: AutoChildState;
};

const WORD: Readonly<Record<AutoChildState, string>> = {
  running: NAMES.running,
  done: NAMES.done,
  failed: NAMES.failed,
  stopped: NAMES.stopped,
  timedOut: NAMES.failed,
  returned: NAMES.idle,
  neverStarted: NAMES.notStarted,
  retried: 'Retried',
  queued: NAMES.queued,
};

export const autoChildWordOf = ({ state }: Params): string => WORD[state];
