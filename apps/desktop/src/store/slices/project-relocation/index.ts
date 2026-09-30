import { findMovedProjects } from './findMovedProjects';
import { projectRelocationInitialState } from './state';
import { relocateProjects } from './relocateProjects';
import { undoRelocation } from './undoRelocation';
import type { SliceDeps } from '../../slice-types';

export const createProjectRelocationSlice = ({ set, get }: SliceDeps) => ({
  ...projectRelocationInitialState,
  findMovedProjects: findMovedProjects(set, get),
  relocateProjects: relocateProjects(set, get),
  undoRelocation: undoRelocation(set, get),
  setProjectRelocationSelected: ({
    projectId,
    isSelected,
  }: {
    readonly projectId: string;
    readonly isSelected: boolean;
  }) => {
    set((state) => ({
      projectRelocationCandidates: state.projectRelocationCandidates.map((candidate) =>
        candidate.projectId === projectId ? { ...candidate, isSelected } : candidate,
      ),
    }));
  },
  clearProjectRelocation: () => set(projectRelocationInitialState),
});
