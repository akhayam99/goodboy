import type { SliceDeps } from '../../slice-types';
import { noteNextSubjects } from './noteNextSubjects';

export const createNextViewSlice = ({ set }: SliceDeps) => ({
  noteNextSubjects: noteNextSubjects({ set }),
});
