import { Unlink } from 'lucide-react';
import type { ProjectId, SessionId } from '@goodboy/types';
import { NAMES } from '../../../shared/names';
import type { ObjectKindDefinition, ProjectActionTarget } from '../types';

export const PROJECT_DETACH_EVENT = 'goodboy:project-detach';

export type ProjectDetachRequest = {
  readonly projectKey: string;
};

export const projectKeyOf = ({
  sessionId,
  projectId,
}: {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
}): string => `${sessionId}:${projectId}`;

export type ProjectFacts = {
  readonly projectKey: string;
  readonly hasMounts: boolean;
};

export const PROJECT_KIND: ObjectKindDefinition<ProjectActionTarget, ProjectFacts> = {
  noun: 'project',
  facts: ({ state, target }) => {
    const views = state.sessionMounts?.[target.sessionId] ?? null;
    const mounts = state.sessionProjectMounts[target.sessionId] ?? [];
    const hasMounts =
      views === null
        ? mounts.some((mount) => mount.projectId === target.projectId)
        : views.some((view) => view.projectId === target.projectId);
    return {
      projectKey: projectKeyOf({ sessionId: target.sessionId, projectId: target.projectId }),
      hasMounts,
    };
  },
  actions: [
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
