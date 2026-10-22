import type { SliceDeps } from '../../slice-types';
import { chooseNextGroup } from './chooseNextGroup';
import { noteNextSubjects } from './noteNextSubjects';

export const createNextViewSlice = ({ set }: SliceDeps) => ({
  chooseNextGroup: chooseNextGroup({ set }),
  noteNextSubjects: noteNextSubjects({ set }),
});
