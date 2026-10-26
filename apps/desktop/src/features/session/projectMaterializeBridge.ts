import type { UnlistenFn } from '@tauri-apps/api/event';
import { formatError } from '@goodboy/ui';
import type { MountId, ProjectId, SessionId } from '@goodboy/types';
import {
  deferredMaterializeMessage,
  materializationGate,
  proposeMaterialization,
  runMaterializationBatch,
} from '../../store/slices/project-mounts/materializationGate';
import { holdsFolderCapture } from '../../store/slices/file-versions/activeFolderCaptures';
import { useAppStore } from '../../store/store';
import { findMountById } from '../../store/slices/project-mounts/findMountById';
import { recoverSoleMount } from '../../store/slices/project-mounts/recoverSoleMount';
import { selectWritableMounts } from '../../store/slices/project-mounts/selectors';
import { selectProjectById } from '../../store/slices/projects/selectProjectById';
import { serveHandoff } from '../../shared/lib/serveHandoff';

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

export const executeMaterializeRequest = async ({
  sessionId,
  runId,
  projectId,
  projectName,
  reason,
}: MaterializeRequest): Promise<MaterializeOutcome> => {
  const get = useAppStore.getState;
  const project = selectProjectById(get(), projectId);
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
        if (outcome.status === 'in-place') {
          if (!holdsFolderCapture({ sessionId, folderPath: project.rootPath })) {
            return {
              ok: false,
              error: `${project.name} is a plain folder and this turn did not start in it, so nothing written there would be saved. Do not write in it now. The owner can send the next turn with ${project.name} as its destination.`,
            };
          }
          return { ok: true, mountPath: project.rootPath, branch: '' };
        }
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

export const listenProjectMaterializeRequests = (): Promise<UnlistenFn> =>
  serveHandoff<MaterializeRequest, MaterializeOutcome>({
    event: MATERIALIZE_EVENT,
    command: 'project_materialize_result',
    label: 'materialize',
    execute: executeMaterializeRequest,
    replyOf: ({ request, result }) => ({
      id: request.id,
      ok: result.ok,
      error: result.error ?? null,
      mountId: result.mountId ?? null,
      mountPath: result.mountPath ?? null,
      branch: result.branch ?? null,
    }),
  });
