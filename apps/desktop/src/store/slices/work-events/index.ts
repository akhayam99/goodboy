import type { SliceDeps } from '../../slice-types';
import { loadWorkEvents } from './loadWorkEvents';

export const createWorkEventsSlice = ({ set }: SliceDeps) => ({
  loadWorkEvents: loadWorkEvents({ set }),
});
