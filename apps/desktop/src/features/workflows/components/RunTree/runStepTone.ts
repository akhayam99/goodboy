import type { ActivityRowTone } from '@goodboy/ui';
import type { RowState } from '../../../workTreeModel/rowState';
import { rowStateTone } from '../../../workTreeModel/rowStateCopy';

type Params = {
  readonly state: RowState;
};

export const runStepTone = ({ state }: Params): ActivityRowTone => {
  const tone = rowStateTone({ state });
  if (tone === 'danger') {
    return 'failed';
  }
  if (tone === 'warning') {
    return 'attention';
  }
  if (state.phase === 'running') {
    return 'live';
  }
  return state.phase === 'queued' ? 'pending' : 'quiet';
};
