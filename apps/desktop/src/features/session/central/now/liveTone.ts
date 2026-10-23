import type { Tone } from '@goodboy/ui';
import type { RowPhase } from '../../../workTreeModel/rowState';
import type { LiveGroupState } from './liveGroupsOf';

type Spec = Readonly<{
  tone: Tone;
  word: string;
}>;

export const LIVE_TONE: Readonly<{
  state: Readonly<Record<LiveGroupState, Spec>>;
  phase: Readonly<Record<RowPhase, Spec>>;
}> = {
  state: {
    stuck: { tone: 'danger', word: 'Stuck' },
    waiting: { tone: 'warning', word: 'Waits on you' },
    deciding: { tone: 'info', word: 'Deciding' },
    working: { tone: 'info', word: 'Working' },
  },
  phase: {
    queued: { tone: 'neutral', word: 'Queued' },
    running: { tone: 'info', word: 'Working' },
    waiting: { tone: 'warning', word: 'Waits on you' },
    failed: { tone: 'danger', word: 'Failed' },
    done: { tone: 'neutral', word: 'Done' },
    closed: { tone: 'neutral', word: 'Closed' },
    skipped: { tone: 'neutral', word: 'Skipped' },
  },
};
