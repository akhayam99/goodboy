import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import { seedWorkflowLibrary } from '@goodboy/core';
import {
  findWorkspaceByRootPath,
  insertWorkspace,
  reconnectWorkspace as reconnectWorkspaceInDb,
} from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { validateGitRepo } from '../../../shared/lib/repo';
import { formatError } from '../../../shared/lib/errors';
import { invokeWorkflowList } from '../../../features/workflows/workflows';
import { invokeSkillRescan } from '../../../features/skills/skills';
import type { GetFn, SetFn } from './types';

type Input = {
  rootPath: string;
  name?: string;
};

export const addWorkspace = (set: SetFn, get: GetFn) => {
  return async ({ rootPath, name }: Input): Promise<Workspace> => {
    const check = await validateGitRepo(rootPath);
    if (!check.isRepo || !check.rootPath) {
      throw new Error(check.error ?? 'not a git repository');
    }
    const resolvedRoot = check.rootPath;

    const onDisk = await findWorkspaceByRootPath(tauriDatabase, resolvedRoot);
    if (onDisk) {
      if (!onDisk.disconnectedAt) {
        throw new Error(`workspace already exists: ${onDisk.name}`);
      }
      const now = new Date().toISOString() as IsoDateTime;
      await reconnectWorkspaceInDb(tauriDatabase, onDisk.id, now);
      const reactivated: Workspace = { ...onDisk, updatedAt: now, lastAccessedAt: now };
      delete (reactivated as { disconnectedAt?: IsoDateTime }).disconnectedAt;
      set((state) => ({ workspaces: [reactivated, ...state.workspaces] }));
      await get()
        .loadIntegrations(reactivated.id)
        .catch(() => {});
      try {
        const templates = await invokeWorkflowList(reactivated.id);
        set((state) => ({
          phaseTemplates: { ...state.phaseTemplates, [reactivated.id]: templates },
        }));
      } catch {
        // non-fatal: templates can be re-fetched on next workspace switch
      }
      return reactivated;
    }

    const inferredName =
      name?.trim() || resolvedRoot.split('/').filter(Boolean).at(-1) || 'workspace';
    const now = new Date().toISOString() as IsoDateTime;
    const workspace: Workspace = {
      id: crypto.randomUUID() as WorkspaceId,
      name: inferredName,
      rootPath: resolvedRoot,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };
    try {
      await insertWorkspace(tauriDatabase, workspace);
    } catch (err) {
      const msg = formatError(err);
      if (msg.toLowerCase().includes('unique')) {
        throw new Error(`workspace already exists at ${resolvedRoot}`);
      }
      throw new Error(`failed to register workspace: ${msg}`);
    }
    set((state) => ({ workspaces: [workspace, ...state.workspaces] }));

    try {
      await seedWorkflowLibrary({ db: tauriDatabase }, workspace.id);
      const templates = await invokeWorkflowList(workspace.id);
      set((state) => ({
        phaseTemplates: { ...state.phaseTemplates, [workspace.id]: templates },
      }));
    } catch {
      // Workflow seeding must not block workspace creation; user can edit later.
    }

    try {
      const skills = await invokeSkillRescan(workspace.id);
      set((state) => ({ skills: { ...state.skills, [workspace.id]: skills } }));
    } catch {
      // Discovery failure must not block workspace creation; user can rescan from Settings.
    }

    return workspace;
  };
};
