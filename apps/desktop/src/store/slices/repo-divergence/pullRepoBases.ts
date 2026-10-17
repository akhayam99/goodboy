import type { ProjectId, WorkspaceId } from '@goodboy/types';
import {
  pullBaseInRepos,
  type PullOutcome,
} from '../../../features/workspace/pullBase/pullBaseInRepos';
import { readRepoDivergence } from './readRepoDivergence';
import type { RepoPull } from './state';
import { workspaceReposOf } from './workspaceReposOf';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly projectIds: ReadonlyArray<ProjectId>;
};

type MarkParams = {
  readonly set: SetFn;
  readonly projectId: ProjectId;
  readonly pull: RepoPull | null;
};

const markPull = ({ set, projectId, pull }: MarkParams): void => {
  set((state) => {
    const { [projectId]: _dropped, ...rest } = state.repoPull;
    return { repoPull: pull === null ? rest : { ...rest, [projectId]: pull } };
  });
};

export const pullRepoBases = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, projectIds }: Input): Promise<ReadonlyArray<PullOutcome>> => {
    const projects = workspaceReposOf({ projects: get().projects, workspaceId }).filter(
      (project) =>
        projectIds.includes(project.id) && get().repoPull[project.id]?.kind !== 'pulling',
    );
    if (projects.length === 0) {
      return [];
    }
    for (const project of projects) {
      markPull({ set, projectId: project.id, pull: { kind: 'pulling' } });
    }
    const outcomes = await pullBaseInRepos({ projects });
    for (const outcome of outcomes) {
      markPull({
        set,
        projectId: outcome.projectId,
        pull: outcome.kind === 'updated' ? null : { kind: 'refused', reason: outcome.reason },
      });
    }
    await Promise.all(
      projects.map((project) => readRepoDivergence({ set, get, project, maxAgeMs: 0 })),
    );
    return outcomes;
  };
};
