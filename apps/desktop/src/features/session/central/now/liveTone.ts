import { NAMES } from '../../../../shared/utils/names';
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
    failed: { tone: 'danger', word: NAMES.failed },
    waiting: { tone: 'warning', word: NAMES.needsYou },
    deciding: { tone: 'info', word: NAMES.running },
    working: { tone: 'info', word: NAMES.running },
  },
  phase: {
    queued: { tone: 'neutral', word: NAMES.queued },
    running: { tone: 'info', word: NAMES.running },
    waiting: { tone: 'warning', word: NAMES.needsYou },
    failed: { tone: 'danger', word: NAMES.failed },
    done: { tone: 'neutral', word: NAMES.done },
    closed: { tone: 'neutral', word: NAMES.closed },
    skipped: { tone: 'neutral', word: NAMES.skipped },
  },
};
