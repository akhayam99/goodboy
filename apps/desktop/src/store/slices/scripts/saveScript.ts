import type { IsoDateTime, WorkspaceId, WorkspaceScript, WorkspaceScriptId } from '@goodboy/types';
import { upsertWorkspaceScript } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import type { GetFn } from './types';

type Params = {
  workspaceId: WorkspaceId;
  id?: WorkspaceScriptId;
  name: string;
  body: string;
};

export function saveScript(get: GetFn) {
  return async ({ workspaceId, id, name, body }: Params) => {
    const now = new Date().toISOString() as IsoDateTime;
    const existing = id
      ? (get().workspaceScripts[workspaceId] ?? []).find((s) => s.id === id)
      : undefined;
    const script: WorkspaceScript = {
      id: id ?? (crypto.randomUUID() as WorkspaceScriptId),
      workspaceId,
      name,
      body,
      sortOrder: existing?.sortOrder ?? get().workspaceScripts[workspaceId]?.length ?? 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    await upsertWorkspaceScript(tauriDatabase, script);
    await get().loadScripts(workspaceId);
  };
}
