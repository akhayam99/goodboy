import type { SliceDeps } from '../../slice-types';
import { setNewDrawerAutoGoal } from './setNewDrawerAutoGoal';

export const createNewDrawerDraftsSlice = ({ set }: SliceDeps) => {
  return {
    setNewDrawerAutoGoal: setNewDrawerAutoGoal(set),
  };
};
