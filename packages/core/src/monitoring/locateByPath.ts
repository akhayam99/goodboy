import { pathContains } from './pathContains';
import type { AttributionProject, AttributionSession, Location } from './types';

type Params = {
  readonly paths: ReadonlyArray<string>;
  readonly sessions: ReadonlyArray<AttributionSession>;
  readonly projects: ReadonlyArray<AttributionProject>;
};

type Best<Value> = { readonly length: number; readonly value: Value };

const NOWHERE: Location = { sessionId: null, worktreePath: null, projectId: null };

export const locateByPath = ({ paths, sessions, projects }: Params): Location => {
  for (const path of paths) {
    let bestWorktree: Best<Location> | null = null;
    for (const session of sessions) {
      for (const worktree of session.worktrees) {
        if (!pathContains({ root: worktree.path, path })) {
          continue;
        }
        if (bestWorktree !== null && bestWorktree.length >= worktree.path.length) {
          continue;
        }
        bestWorktree = {
          length: worktree.path.length,
          value: {
            sessionId: session.id,
            worktreePath: worktree.path,
            projectId: worktree.projectId,
          },
        };
      }
    }
    let bestProject: Best<string> | null = null;
    for (const project of projects) {
      if (!pathContains({ root: project.rootPath, path })) {
        continue;
      }
      if (bestProject !== null && bestProject.length >= project.rootPath.length) {
        continue;
      }
      bestProject = { length: project.rootPath.length, value: project.id };
    }
    if (bestWorktree !== null) {
      return {
        ...bestWorktree.value,
        projectId: bestWorktree.value.projectId ?? bestProject?.value ?? null,
      };
    }
    if (bestProject !== null) {
      return { sessionId: null, worktreePath: null, projectId: bestProject.value };
    }
  }
  return NOWHERE;
};
