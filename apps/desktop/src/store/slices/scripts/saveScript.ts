import type { IsoDateTime, WorkspaceId, ProjectScript, ProjectScriptId } from '@goodboy/types';
import { upsertProjectScript } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type Params = {
  workspaceId: WorkspaceId;
  id?: ProjectScriptId;
  name: string;
  body: string;
};

export const saveScript = (get: GetFn) => {
  return async ({ workspaceId, id, name, body }: Params) => {
    const project = get().projects.find((candidate) => candidate.workspaceId === workspaceId);
    if (project === undefined) {
      throw new Error(`workspace has no projects: ${workspaceId}`);
    }
    const now = new Date().toISOString() as IsoDateTime;
    const existing = id
      ? (get().projectScripts[workspaceId] ?? []).find((s) => s.id === id)
      : undefined;
    const script: ProjectScript = {
      id: id ?? (crypto.randomUUID() as ProjectScriptId),
      projectId: existing?.projectId ?? project.id,
      name,
      body,
      sortOrder: existing?.sortOrder ?? get().projectScripts[workspaceId]?.length ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertProjectScript({ db: tauriDatabase, script });
    await get().loadScripts(workspaceId);
  };
};
