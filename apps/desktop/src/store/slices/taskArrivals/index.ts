import { markTasksSeen } from './markTasksSeen';
import { noteTaskRecords } from './noteTaskRecords';
import type { SliceDeps } from '../../slice-types';

export const createTaskArrivalsSlice = ({ set, get }: SliceDeps) => {
  return {
    noteTaskRecords: noteTaskRecords({ set, get }),
    markTasksSeen: markTasksSeen({ set, get }),
  };
};
