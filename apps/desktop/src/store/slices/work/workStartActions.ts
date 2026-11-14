import type { SliceDeps } from '../../slice-types';
import type { WorkSlice } from './types';

export const workStartActionsOf = ({
  set,
}: Pick<SliceDeps, 'set'>): Pick<WorkSlice, 'openWorkStart' | 'closeWorkStart'> => ({
  openWorkStart: ({ seed }) => set({ workStart: seed }),
  closeWorkStart: () => set({ workStart: null }),
});
