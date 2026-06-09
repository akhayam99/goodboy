import type { IsoDateTime, Workspace, WorkspaceId, WorkspaceMember } from '@goodboy/types';
import { seedWorkflowLibrary } from '@goodboy/core';
import { insertWorkspace, insertWorkspaceMembers } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { invokeWorkflowList } from '../../../features/workflows/workflows';
import type { GetFn, SetFn } from './types';

interface Input {
  name?: string;
  containerPath: string;
  members: ReadonlyArray<{ workspaceId: WorkspaceId; mountName: string }>;
}

export function addCompositeWorkspace(set: SetFn, get: GetFn) {
  return async ({ name, containerPath, members }: Input): Promise<Workspace> => {
    if (members.length < 2) {
      throw new Error('a multi-project workspace needs at least two repos');
    }
    const seenMounts = new Set<string>();
    for (const m of members) {
      const mount = m.mountName.trim();
      if (mount.length === 0) throw new Error('every repo needs a mount name');
      if (seenMounts.has(mount)) throw new Error(`duplicate mount name: ${mount}`);
      seenMounts.add(mount);
    }

    const known = get().workspaces;
    const resolved: WorkspaceMember[] = members.map((m) => {
      const ws = known.find((w) => w.id === m.workspaceId);
      if (!ws) throw new Error('member workspace not found');
      if (ws.kind === 'composite') {
        throw new Error('cannot nest a multi-project workspace inside another');
      }
      return { workspaceId: m.workspaceId, rootPath: ws.rootPath, mountName: m.mountName.trim() };
    });

    const now = new Date().toISOString() as IsoDateTime;
    const workspace: Workspace = {
      id: crypto.randomUUID() as WorkspaceId,
      name: name?.trim() || resolved.map((m) => m.mountName).join(' + '),
      rootPath: containerPath,
      kind: 'composite',
      members: resolved,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    };

    await insertWorkspace(tauriDatabase, workspace);
    await insertWorkspaceMembers(
      tauriDatabase,
      workspace.id,
      resolved.map((m) => ({ workspaceId: m.workspaceId, mountName: m.mountName })),
    );
    set((state) => ({ workspaces: [workspace, ...state.workspaces] }));

    await seedWorkflowLibrary({ db: tauriDatabase }, workspace.id).catch(() => undefined);
    const templates = await invokeWorkflowList(workspace.id).catch(() => []);
    set((state) => ({ phaseTemplates: { ...state.phaseTemplates, [workspace.id]: templates } }));

    return workspace;
  };
}
