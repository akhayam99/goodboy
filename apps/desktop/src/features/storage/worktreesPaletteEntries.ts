import type { Project, ProjectId, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../shared/components/conceptIcons';
import { NAMES } from '../../shared/utils/names';
import type { PaletteEntry } from '../palette/types';

type OpenParams = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

type Params = {
  readonly sessionId: SessionId | null;
  readonly projects: ReadonlyArray<Project>;
  readonly sessionProjectIds: ReadonlyArray<ProjectId>;
  readonly open: (params: OpenParams) => void;
};

export const worktreesPaletteEntries = ({
  sessionId,
  projects,
  sessionProjectIds,
  open,
}: Params): ReadonlyArray<PaletteEntry> => {
  if (sessionId === null) {
    return [];
  }
  return projects
    .filter((project) => project.kind === 'repo' && sessionProjectIds.includes(project.id))
    .map((project) => ({
      key: `action:worktrees:${project.id}`,
      label: `${NAMES.worktrees} in ${project.name}`,
      secondary: ['Remove safe worktrees', NAMES.removeWorktrees, NAMES.newBranch],
      kind: 'action',
      group: 'action',
      icon: CONCEPT_ICONS.worktree,
      run: () => open({ sessionId, projectId: project.id }),
    }));
};
