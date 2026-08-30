import { addProject } from './addProject';
import { addProjects } from './addProjects';
import { adoptProject } from './adoptProject';
import { convertProjectToRepo } from './convertProjectToRepo';
import { fastForwardProjectCheckout } from './fastForwardProjectCheckout';
import { loadProjectGitStatus } from './loadProjectGitStatus';
import { previewProjectAdoption } from './previewProjectAdoption';
import { removeProject } from './removeProject';
import { updateProjectBaseBranch } from './updateProjectBaseBranch';
import type { GetFn, SetFn } from './types';

export const createProjectsSlice = (set: SetFn, get: GetFn) => ({
  addProject: addProject(set, get),
  addProjects: addProjects(set, get),
  adoptProject: adoptProject(set, get),
  previewProjectAdoption: previewProjectAdoption(set, get),
  removeProject: removeProject(set, get),
  convertProjectToRepo: convertProjectToRepo(set, get),
  loadProjectGitStatus: loadProjectGitStatus(set, get),
  fastForwardProjectCheckout: fastForwardProjectCheckout(set, get),
  updateProjectBaseBranch: updateProjectBaseBranch(set, get),
});
