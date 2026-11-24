import type { ActivityRowTone } from '@goodboy/ui';
import {
  isRowNeedingYou,
  type RowPhase,
  type RowState,
} from '../../../../../workTreeModel/rowState';

type Params = {
  readonly state: RowState;
};

const PHASE_TONE: Record<RowPhase, ActivityRowTone> = {
  queued: 'pending',
  running: 'live',
  waiting: 'quiet',
  failed: 'failed',
  done: 'quiet',
  closed: 'pending',
  skipped: 'pending',
};

export const timelineRowTone = ({ state }: Params): ActivityRowTone => {
  if (state.phase !== 'failed' && isRowNeedingYou({ state })) {
    return 'attention';
  }
  if (state.reason?.kind === 'agentStopped' || state.reason?.kind === 'stepStopped') {
    return 'pending';
  }
  return PHASE_TONE[state.phase];
};
