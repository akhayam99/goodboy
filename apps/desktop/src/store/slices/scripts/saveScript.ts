import type {
  IsoDateTime,
  ProjectId,
  WorkspaceId,
  ProjectScript,
  ProjectScriptId,
} from '@goodboy/types';
import { upsertProjectScript } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type Params = {
  workspaceId: WorkspaceId;
  projectId: ProjectId;
  id?: ProjectScriptId;
  name: string;
  body: string;
};

export const saveScript = (get: GetFn) => {
  return async ({ workspaceId, projectId, id, name, body }: Params) => {
    const now = new Date().toISOString() as IsoDateTime;
    const existing =
      id !== undefined
        ? (get().projectScripts[workspaceId] ?? []).find((s) => s.id === id)
        : undefined;
    const script: ProjectScript = {
      id: id ?? (crypto.randomUUID() as ProjectScriptId),
      projectId,
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
