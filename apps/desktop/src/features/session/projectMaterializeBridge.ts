import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { formatError } from '@goodboy/ui';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import {
  deferredMaterializeMessage,
  materializationGate,
  priorMountCount,
  proposeMaterialization,
  runMaterializationBatch,
} from '../../store/materializationGate';
import { useAppStore } from '../../store/store';
import { findMountById } from '../../store/slices/project-mounts/findMountById';
import { selectWritableMounts } from '../../store/slices/project-mounts/selectors';
import { isMainWindow } from '../workspace/window';

const MATERIALIZE_EVENT = 'query-bridge://project-materialize';

type MaterializeRequest = {
  readonly id: string;
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly reason: string;
};

type MaterializeOutcome = {
  readonly ok: boolean;
  readonly error?: string;
  readonly mountId?: MountId;
  readonly mountPath?: string;
  readonly branch?: string;
};

const inTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const executeMaterializeRequest = async (
  request: MaterializeRequest,
): Promise<MaterializeOutcome> => {
  const get = useAppStore.getState;
  const project = get().projects.find((candidate) => candidate.id === request.projectId) ?? null;
  if (project === null) {
    return { ok: false, error: `unknown project: ${request.projectName}` };
  }
  return runMaterializationBatch({
    sessionId: request.sessionId,
    run: async () => {
      const decision = materializationGate({
        get,
        sessionId: request.sessionId,
        project,
        priorMounts: priorMountCount({ get, sessionId: request.sessionId }),
        immediateCount: 0,
      });
      if (decision.kind === 'deferred') {
        await proposeMaterialization({
          get,
          sessionId: request.sessionId,
          project,
          reason: request.reason,
          cause: decision.cause,
          agentId: null,
          turnRunId: null,
        });
        return {
          ok: false,
          error: deferredMaterializeMessage({
            projectName: project.name,
            cause: decision.cause,
          }),
        };
      }
      try {
        const outcome = await get().ensureProjectMounted({
          sessionId: request.sessionId,
          projectId: request.projectId,
          reason: request.reason,
        });
        const mountId =
          outcome.status === 'created' ? outcome.createdMountId : (outcome.mountIds[0] ?? null);
        if (outcome.status === 'already-mounted' && outcome.mountIds.length > 1) {
          return {
            ok: false,
            error: `${project.name} already has ${outcome.mountIds.length} branch mounts. Run \`mount list\` and work in the one you mean.`,
          };
        }
        const mount = findMountById({
          mounts: selectWritableMounts({ state: get(), sessionId: request.sessionId }),
          mountId,
        });
        if (mount === null) {
          return { ok: false, error: `the mount of ${project.name} is not available` };
        }
        return {
          ok: true,
          mountId: mount.mountId,
          mountPath: mount.worktreePath,
          branch: mount.branch,
        };
      } catch (error) {
        return { ok: false, error: formatError(error) };
      }
    },
  });
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
          mountId: result.mountId ?? null,
          mountPath: result.mountPath ?? null,
          branch: result.branch ?? null,
        }),
      )
      .catch((error) => console.error('[query-bridge] materialize result dispatch failed', error));
  });
};
