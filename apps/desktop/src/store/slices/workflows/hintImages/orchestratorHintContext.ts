import type { OrchestratorClientDeps, OrchestratorInput } from '@goodboy/core/orchestrator';
import type { OrchestratorHint, SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
import { selectWritableMounts } from '../../project-mounts/selectors';
import { buildProfileGuard } from '../../turn/profileGuard';
import { getSessionRepo } from '../../worktrees/getSessionRepo';
import { buildWorkspaceProjectsBlock } from '../buildWorkspaceProjectsBlock';
import { hintImagePaths } from './hintImagePaths';
import { formatOrchestratorHints } from '../orchestratorHintQueue';
import type { GetFn } from '../types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly workspaceId: WorkspaceId;
  readonly hints: ReadonlyArray<OrchestratorHint>;
};

type Result = {
  readonly clientDeps: Pick<OrchestratorClientDeps, 'workingDir' | 'readDirs'>;
  readonly hintInput: Pick<
    OrchestratorInput,
    'operatorHints' | 'canReadFiles' | 'decisions' | 'mounts'
  >;
};

export const orchestratorHintContext = async ({
  get,
  sessionId,
  workflowRunId,
  workspaceId,
  hints,
}: Params): Promise<Result> => {
  await get().loadGoalAttachments({ type: 'workflow_run', id: workflowRunId });
  const profileBlock = buildProfileGuard({
    profile: get().workspaces.find((candidate) => candidate.id === workspaceId)?.profile,
    audience: 'orchestrator',
  });
  const projectsBlock = buildWorkspaceProjectsBlock({
    projects: get().projects.filter((project) => project.workspaceId === workspaceId),
  });
  const hintsWorktreeDir = (get().sessionWorktrees ?? {})[sessionId]?.[0] ?? null;
  const scratchDir = (get().sessionScratchDirs ?? {})[sessionId] ?? null;
  const imagePaths = hintImagePaths({
    hints,
    attachments: (get().workflowRunAttachments ?? {})[workflowRunId] ?? [],
    worktreeDir: hintsWorktreeDir,
    scratchDir,
  });
  const canReadFiles = Object.keys(imagePaths).length > 0;
  const imageFiles = Object.values(imagePaths).flat();
  const hasScratchImages = imageFiles.some(
    (path) => scratchDir !== null && path.startsWith(scratchDir),
  );
  const hasWorktreeImages = imageFiles.some(
    (path) => scratchDir === null || !path.startsWith(scratchDir),
  );
  const imageCwd = hasWorktreeImages ? hintsWorktreeDir : scratchDir;
  const readDirs = hasWorktreeImages && hasScratchImages && scratchDir !== null ? [scratchDir] : [];
  const operatorHints = [
    profileBlock,
    projectsBlock,
    formatOrchestratorHints({ hints, imagePaths }),
  ]
    .map((entry) => entry?.trim() ?? '')
    .filter((entry) => entry !== '')
    .join('\n');
  const worktreePath = canReadFiles
    ? imageCwd
    : (getSessionRepo({ get, sessionId })?.worktreePath ?? null);
  const decisionsSlot = ((get().sessionSlots ?? {})[sessionId] ?? []).find(
    (slot) => slot.key === 'decisions' && slot.enabled,
  );
  return {
    clientDeps: {
      ...(worktreePath != null && { workingDir: worktreePath }),
      ...(readDirs.length > 0 && { readDirs }),
    },
    hintInput: {
      ...(operatorHints !== '' && { operatorHints }),
      ...(canReadFiles && { canReadFiles: true }),
      decisions: decisionsSlot?.value ?? '',
      mounts: selectWritableMounts({ state: get(), sessionId }).map((mount) => ({
        id: mount.mountId,
        name: mount.mountName,
        branch: mount.branch,
      })),
    },
  };
};
