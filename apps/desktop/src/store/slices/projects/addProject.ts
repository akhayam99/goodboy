import type {
  IsoDateTime,
  OverrideSettings,
  Project,
  ProjectId,
  WorkspaceId,
} from '@goodboy/types';
import { findProjectByRootPath, insertProject, reconnectProject } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { validateGitRepo } from '../../../shared/lib/repo';
import type { GetFn, SetFn } from './types';

type Input = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly name?: string;
  readonly requireRepo?: boolean;
};

const EMPTY_OVERRIDES: OverrideSettings = {
  defaultProviderId: null,
  defaultWorkflowId: null,
  defaultBranchPrefix: null,
  parallelEnabled: null,
  defaultVerbosity: null,
  providerBindings: null,
  taskModels: null,
  roleModels: null,
  parallelAgents: null,
  providerPool: null,
};

export const addProject = (set: SetFn, get: GetFn) => {
  return async ({ workspaceId, rootPath, name, requireRepo = false }: Input): Promise<Project> => {
    if (get().workspaces.every((workspace) => workspace.id !== workspaceId)) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    const check = await validateGitRepo(rootPath);
    const isRepo = check.isRepo && check.rootPath != null && check.rootPath !== '';
    if (requireRepo && !isRepo) {
      throw new Error(
        `no git repository at ${rootPath}. pick a folder with a .git directory, or use New project to initialize one`,
      );
    }
    const resolvedRoot = isRepo ? check.rootPath : check.resolvedPath;
    if (resolvedRoot == null || resolvedRoot === '') {
      throw new Error(check.error ?? 'folder not found');
    }
    const existing = await findProjectByRootPath({ db: tauriDatabase, rootPath: resolvedRoot });
    if (existing !== null) {
      if (existing.workspaceId === workspaceId && existing.disconnectedAt !== undefined) {
        const at = new Date().toISOString() as IsoDateTime;
        await reconnectProject({ db: tauriDatabase, id: existing.id, at });
        const reconnected: Project = {
          ...existing,
          updatedAt: at,
          lastAccessedAt: at,
          disconnectedAt: undefined,
        };
        set((state) => ({
          projects: [
            ...state.projects.filter((project) => project.id !== existing.id),
            reconnected,
          ],
        }));
        return reconnected;
      }
      throw new Error(`project already exists: ${existing.name}`);
    }
    const projectName =
      name?.trim() ||
      resolvedRoot
        .split('/')
        .filter((part) => part.length > 0)
        .at(-1) ||
      'project';
    const now = new Date().toISOString() as IsoDateTime;
    const project: Project = {
      id: crypto.randomUUID() as ProjectId,
      workspaceId,
      name: projectName,
      rootPath: resolvedRoot,
      kind: isRepo ? 'repo' : 'folder',
      overrides: EMPTY_OVERRIDES,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };
    await insertProject({ db: tauriDatabase, project });
    set((state) => ({ projects: [...state.projects, project] }));
    return project;
  };
};
