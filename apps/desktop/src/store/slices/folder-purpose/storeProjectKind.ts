import type { Project, ProjectId } from '@goodboy/types';
import { nowIso } from '../project-mounts/nowIso';
import type { SetFn } from './types';

type KindParams = {
  readonly set: SetFn;
  readonly projectId: ProjectId;
  readonly kind: Project['kind'];
  readonly rootPath: string;
};

export const storeProjectKind = ({ set, projectId, kind, rootPath }: KindParams): void =>
  set((state) => ({
    projects: state.projects.map((candidate) =>
      candidate.id === projectId
        ? {
            ...candidate,
            kind,
            rootPath,
            updatedAt: nowIso({}),
          }
        : candidate,
    ),
  }));
