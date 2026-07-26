import type { IsoDateTime, Workspace, WorkspaceId } from '@goodboy/types';
import { seedWorkflowLibrary } from '@goodboy/core';
import { findWorkspaceByRootPath, insertWorkspace } from '@goodboy/db';
import { invokeSkillRescan } from '../../../features/skills/skills';
import { prepareSimpleWorkspace } from '../../../features/workspace/prepareSimpleWorkspace';
import { invokeWorkflowList } from '../../../features/workflows/workflows';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn, SetFn } from './types';

type Input = {
  name: string;
  path: string;
};

export const addSimpleWorkspace = (set: SetFn, get: GetFn) => {
  return async ({ name, path }: Input): Promise<Workspace> => {
    const trimmedName = name.trim();
    const trimmedPath = path.trim();
    if (trimmedName.length === 0) {
      throw new Error('workspace name cannot be empty');
    }
    if (trimmedPath.length === 0) {
      throw new Error('workspace directory cannot be empty');
    }
    const resolvedRoot = await prepareSimpleWorkspace({ path: trimmedPath });
    const existingInState = get().workspaces.find(
      (workspace) => workspace.rootPath === resolvedRoot,
    );
    if (existingInState != null) {
      throw new Error(`workspace already exists: ${existingInState.name}`);
    }
    const existing = await findWorkspaceByRootPath(tauriDatabase, resolvedRoot);
    if (existing != null) {
      throw new Error(`workspace already exists: ${existing.name}`);
    }
    const now = new Date().toISOString() as IsoDateTime;
    const workspace: Workspace = {
      id: crypto.randomUUID() as WorkspaceId,
      name: trimmedName,
      rootPath: resolvedRoot,
      kind: 'simple',
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };
    await insertWorkspace(tauriDatabase, workspace);
    set((state) => ({ workspaces: [workspace, ...state.workspaces] }));

    await seedWorkflowLibrary({ db: tauriDatabase }, workspace.id).catch(() => undefined);
    const templates = await invokeWorkflowList(workspace.id).catch(() => []);
    set((state) => ({ phaseTemplates: { ...state.phaseTemplates, [workspace.id]: templates } }));
    const skills = await invokeSkillRescan(workspace.id).catch(() => []);
    set((state) => ({ skills: { ...state.skills, [workspace.id]: skills } }));

    return workspace;
  };
};
