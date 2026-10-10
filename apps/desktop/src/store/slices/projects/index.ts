import { addProject } from './addProject';
import { addProjects } from './addProjects';
import { adoptProject } from './adoptProject';
import { clearProjectModelOverrides } from './clearProjectModelOverrides';
import { checkGoodboyIgnore } from './checkGoodboyIgnore';
import { convertProjectToRepo } from './convertProjectToRepo';
import { describeProject } from './describeProject';
import { fastForwardProjectCheckout } from './fastForwardProjectCheckout';
import { fastForwardProjectCheckouts } from './fastForwardProjectCheckouts';
import { fetchProjectCheckouts } from './fetchProjectCheckouts';
import { linkProjectRemote } from './linkProjectRemote';
import { loadProjectGitStatus } from './loadProjectGitStatus';
import { previewProjectAdoption } from './previewProjectAdoption';
import { publishProjectMain } from './publishProjectMain';
import { removeProject } from './removeProject';
import { saveGoodboyIgnore } from './saveGoodboyIgnore';
import { setProjectStarred } from './setProjectStarred';
import { updateProjectAfterMerge } from './updateProjectAfterMerge';
import { updateProjectBaseBranch } from './updateProjectBaseBranch';
import type { SliceDeps } from '../../slice-types';

export const createProjectsSlice = ({ set, get }: SliceDeps) => ({
  addProject: addProject(set, get),
  addProjects: addProjects(set, get),
  adoptProject: adoptProject(set, get),
  previewProjectAdoption: previewProjectAdoption(set, get),
  removeProject: removeProject(set, get),
  convertProjectToRepo: convertProjectToRepo(set, get),
  linkProjectRemote: linkProjectRemote(set, get),
  publishProjectMain: publishProjectMain(set, get),
  loadProjectGitStatus: loadProjectGitStatus(set, get),
  fastForwardProjectCheckout: fastForwardProjectCheckout(set, get),
  fetchProjectCheckouts: fetchProjectCheckouts(set, get),
  fastForwardProjectCheckouts: fastForwardProjectCheckouts(set, get),
  updateProjectBaseBranch: updateProjectBaseBranch(set, get),
  updateProjectAfterMerge: updateProjectAfterMerge(set, get),
  clearProjectModelOverrides: clearProjectModelOverrides(set, get),
  setProjectStarred: setProjectStarred(set, get),
  describeProject: describeProject(set, get),
  checkGoodboyIgnore: checkGoodboyIgnore(set, get),
  saveGoodboyIgnore: saveGoodboyIgnore(set, get),
});
