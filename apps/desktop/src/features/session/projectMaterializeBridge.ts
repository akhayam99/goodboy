import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { formatError } from '@goodboy/ui';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import {
  deferredMaterializeMessage,
  materializationGate,
  proposeMaterialization,
  runMaterializationBatch,
} from '../../store/materializationGate';
import { useAppStore } from '../../store/store';
import { findMountById } from '../../store/slices/project-mounts/findMountById';
import { recoverSoleMount } from '../../store/slices/project-mounts/recoverSoleMount';
import { selectWritableMounts } from '../../store/slices/project-mounts/selectors';
import { isMainWindow } from '../workspace/window';

const MATERIALIZE_EVENT = 'query-bridge://project-materialize';

type MaterializeRequest = {
  readonly id: string;
  readonly runId?: string | null;
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

export const executeMaterializeRequest = async ({
  sessionId,
  runId,
  projectId,
  projectName,
  reason,
}: MaterializeRequest): Promise<MaterializeOutcome> => {
  const get = useAppStore.getState;
  const project = get().projects.find((candidate) => candidate.id === projectId) ?? null;
  if (project === null) {
    return { ok: false, error: `unknown project: ${projectName}` };
  }
  return runMaterializationBatch({
    sessionId,
    ...(runId == null || runId.trim() === '' ? {} : { batchId: runId }),
    run: async ({ budget }) => {
      const decision = materializationGate({
        get,
        sessionId,
        project,
        immediateProjectIds: budget.immediateProjectIds,
      });
      if (decision.kind === 'deferred') {
        const proposal = await proposeMaterialization({
          get,
          sessionId,
          project,
          reason,
          cause: decision.cause,
          agentId: null,
          turnRunId: null,
        });
        return {
          ok: false,
          error: deferredMaterializeMessage({
            projectName: project.name,
            cause: decision.cause,
            isAlreadyPending: proposal === 'already-pending',
          }),
        };
      }
      try {
        const outcome = await get().ensureProjectMounted({
          sessionId,
          projectId,
          reason,
        });
        if (outcome.status === 'created') {
          budget.immediateProjectIds.add(project.id);
        }
        if (outcome.status === 'already-mounted' && outcome.mountIds.length !== 1) {
          return {
            ok: false,
            error: `${project.name} already has ${outcome.mountIds.length} branch mounts. Run \`mount list\` and work in the one you mean.`,
          };
        }
        const owned = selectWritableMounts({ state: get(), sessionId }).filter(
          (candidate) => candidate.projectId === projectId,
        );
        const mount =
          outcome.status === 'created'
            ? findMountById({ mounts: owned, mountId: outcome.createdMountId })
            : recoverSoleMount({ mounts: owned });
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
