import { addProject } from './addProject';
import { addProjects } from './addProjects';
import { convertProjectToRepo } from './convertProjectToRepo';
import { fastForwardProjectCheckout } from './fastForwardProjectCheckout';
import { loadProjectGitStatus } from './loadProjectGitStatus';
import { removeProject } from './removeProject';
import type { GetFn, SetFn } from './types';

export const createProjectsSlice = (set: SetFn, get: GetFn) => ({
  addProject: addProject(set, get),
  addProjects: addProjects(set, get),
  removeProject: removeProject(set, get),
  convertProjectToRepo: convertProjectToRepo(set, get),
  loadProjectGitStatus: loadProjectGitStatus(set, get),
  fastForwardProjectCheckout: fastForwardProjectCheckout(set, get),
});
