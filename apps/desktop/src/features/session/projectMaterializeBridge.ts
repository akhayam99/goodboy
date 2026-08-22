import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { formatError } from '@goodboy/ui';
import type { ProjectId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../store/store';
import { isMainWindow } from '../workspace/window';

const MATERIALIZE_EVENT = 'query-bridge://project-materialize';

type MaterializeRequest = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly reason: string;
};

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const executeMaterializeRequest = async (
  request: MaterializeRequest,
): Promise<{ ok: boolean; error?: string; mountPath?: string; branch?: string }> => {
  try {
    const mount = await useAppStore.getState().materializeProject({
      sessionId: request.sessionId,
      projectId: request.projectId,
      reason: request.reason,
    });
    return { ok: true, mountPath: mount.worktreePath, branch: mount.branch };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
};

export const listenProjectMaterializeRequests = async (): Promise<UnlistenFn> => {
  if (!inTauri() || !isMainWindow()) {
    return () => undefined;
  }
  return listen<MaterializeRequest>(MATERIALIZE_EVENT, (event) => {
    const request = event.payload;
    void executeMaterializeRequest(request)
      .then((result) =>
        invoke('project_materialize_result', {
          id: request.id,
          ok: result.ok,
          error: result.error ?? null,
          mountPath: result.mountPath ?? null,
          branch: result.branch ?? null,
        }),
      )
      .catch((error) => console.error('[query-bridge] materialize result dispatch failed', error));
  });
};
