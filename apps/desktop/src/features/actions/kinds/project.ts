import { Plus, Unlink } from 'lucide-react';
import type { ProjectId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../shared/utils/names';
import { projectById } from '../../../store/slices/projects/projectIndex';
import { projectKindOf } from '../../../store/slices/projects/projectKindOf';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { dispatchAfterNavigation } from '../dispatchAfterNavigation';
import type { ObjectKindDefinition, ProjectActionTarget } from '../types';

export const PROJECT_DETACH_EVENT = 'goodboy:project-detach';

export type ProjectDetachRequest = {
  readonly projectKey: string;
};

type ProjectKeyParams = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
};

export const projectKeyOf = ({ sessionId, projectId }: ProjectKeyParams): string =>
  `${sessionId}:${projectId}`;

export const projectNewBranchEventOf = ({ sessionId, projectId }: ProjectKeyParams): string =>
  `goodboy:project-new-branch:${sessionId}:${projectId}`;

export type ProjectFacts = {
  readonly projectKey: string;
  readonly projectName: string;
  readonly newBranchEvent: string;
  readonly hasMounts: boolean;
  readonly isRepo: boolean;
  readonly isArchived: boolean;
};

export const PROJECT_KIND: ObjectKindDefinition<ProjectActionTarget, ProjectFacts> = {
  noun: 'folder',
  facts: ({ state, target }) => {
    const views = state.sessionMounts?.[target.sessionId] ?? null;
    const mounts = state.sessionProjectMounts[target.sessionId] ?? [];
    const hasMounts =
      views === null
        ? mounts.some((mount) => mount.projectId === target.projectId)
        : views.some((view) => view.projectId === target.projectId);
    const project = projectById(state.projects, target.projectId) ?? null;
    const mountName = mounts.find((mount) => mount.projectId === target.projectId)?.mountName;
    const isArchivedListed = Object.values(state.archivedSessions)
      .flat()
      .some((session) => session.id === target.sessionId);
    const live = sessionById(state.sessions, target.sessionId) ?? null;
    return {
      projectKey: projectKeyOf({ sessionId: target.sessionId, projectId: target.projectId }),
      projectName: project?.name ?? mountName ?? '',
      newBranchEvent: projectNewBranchEventOf({
        sessionId: target.sessionId,
        projectId: target.projectId,
      }),
      hasMounts,
      isRepo: projectKindOf({ project }) === 'repo',
      isArchived: isArchivedListed || (live !== null && live.archivedAt != null),
    };
  },
  actions: [
    {
      id: 'project.newBranch',
      label: ({ facts }) => `${NAMES.newBranch} in ${facts.projectName}`,
      icon: Plus,
      group: 'act',
      slot: () => 'inline',
      when: ({ facts }) => facts.hasMounts && facts.isRepo && !facts.isArchived,
      run: ({ facts }) => {
        dispatchAfterNavigation({ name: facts.newBranchEvent });
      },
    },
    {
      id: 'project.detach',
      label: NAMES.removeFromSession,
      icon: Unlink,
      group: 'danger',
      hasCustomConfirm: true,
      when: ({ facts }) => facts.hasMounts,
      run: ({ facts }) => {
        window.dispatchEvent(
          new CustomEvent<ProjectDetachRequest>(PROJECT_DETACH_EVENT, {
            detail: { projectKey: facts.projectKey },
          }),
        );
      },
    },
  ],
};
