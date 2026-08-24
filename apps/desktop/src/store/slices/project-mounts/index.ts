import { detachProject } from './detachProject';
import type { GetFn, SetFn } from './types';

export const createProjectMountsSlice = (set: SetFn, get: GetFn) => {
  return {
    detachProject: detachProject(set, get),
  };
};
