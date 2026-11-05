import type { RowState } from '../../../workTreeModel/rowState';

type Params = {
  readonly state: RowState;
};

export const isNotFinishedNote = ({ state }: Params): boolean =>
  state.reason?.kind === 'notFinished' ||
  state.reason?.kind === 'didNotStart' ||
  state.reason?.kind === 'without';
