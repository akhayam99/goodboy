import type { OrchestratorHint, SessionId, WorkflowRunId, WorkspaceId } from '@goodboy/types';
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
  readonly operatorHints: string;
  readonly worktreePath: string | null;
  readonly canReadFiles: boolean;
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
  const imagePaths = hintImagePaths({
    hints,
    attachments: (get().workflowRunAttachments ?? {})[workflowRunId] ?? [],
    worktreeDir: hintsWorktreeDir,
  });
  const canReadFiles = Object.keys(imagePaths).length > 0;
  const operatorHints = [
    profileBlock,
    projectsBlock,
    formatOrchestratorHints({ hints, imagePaths }),
  ]
    .map((entry) => entry?.trim() ?? '')
    .filter((entry) => entry !== '')
    .join('\n');
  const worktreePath = canReadFiles
    ? hintsWorktreeDir
    : (getSessionRepo({ get, sessionId })?.worktreePath ?? null);
  return { operatorHints, worktreePath, canReadFiles };
};
