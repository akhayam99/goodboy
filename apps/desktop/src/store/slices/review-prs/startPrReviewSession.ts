import type {
  GitlabWorkspaceIntegration,
  ProjectId,
  ReviewablePr,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { ghPrDiff } from '../../../features/github/github';
import { gitlabMrDiff } from '../../../features/integrations/gitlab/client';
import { buildPrReviewKickoff } from './buildPrReviewKickoff';
import type { GetFn } from './types';

type FetchDiffParams = {
  get: GetFn;
  workspaceId: WorkspaceId;
  pr: ReviewablePr;
  rootPath: string;
  projectId: ProjectId;
};

const fetchDiff = async ({
  get,
  workspaceId,
  pr,
  rootPath,
  projectId,
}: FetchDiffParams): Promise<string> => {
  if (pr.provider === 'github') {
    return ghPrDiff(pr.repo, pr.number, rootPath, workspaceId, projectId);
  }
  const integration = (get().workspaceIntegrations[workspaceId] ?? []).find(
    (i): i is GitlabWorkspaceIntegration => i.provider === 'gitlab',
  );
  if (integration == null) {
    throw new Error(`gitlab integration not connected for workspace ${workspaceId}`);
  }
  return gitlabMrDiff(workspaceId, integration.config.host, pr.repo, pr.number);
};

export const startPrReviewSession = (get: GetFn) => {
  return async (workspaceId: WorkspaceId, pr: ReviewablePr): Promise<SessionId> => {
    if (pr.mine) {
      throw new Error(`cannot start a review session on an own pull request: ${pr.id}`);
    }
    const workspace = get().workspaces.find((w) => w.id === workspaceId);
    if (workspace == null) {
      throw new Error(`workspace not found: ${workspaceId}`);
    }
    const projects = get().projects.filter((project) => project.workspaceId === workspaceId);
    const project =
      projects.find((candidate) => candidate.id === pr.projectId) ??
      projects.find((candidate) => candidate.kind === 'repo');
    if (project === undefined) {
      throw new Error(`review repository not found for pull request: ${pr.id}`);
    }
    const rootPath = project.rootPath;
    let diff: string | null = null;
    try {
      diff = await fetchDiff({ get, workspaceId, pr, rootPath, projectId: project.id });
    } catch {
      diff = null;
    }
    const kickoffPrompt = buildPrReviewKickoff({ pr, diff });
    const isGitlab = pr.provider === 'gitlab';
    const goal = isGitlab
      ? `Review MR !${pr.number}: ${pr.title}`
      : `Review PR #${pr.number}: ${pr.title}`;
    const { session } = await get().createSession({
      workspaceId,
      goal,
      existingBranch: pr.headBranch,
      fallbackRef: isGitlab ? `merge-requests/${pr.number}/head` : `pull/${pr.number}/head`,
      firstAgentKind: 'pr-reviewer',
      autoRun: true,
      kickoffPrompt,
      externalTasks: [
        {
          provider: pr.provider,
          projectId: project.id,
          externalId: String(pr.number),
          identifier: isGitlab ? `!${pr.number}` : `#${pr.number}`,
          url: pr.url,
          title: pr.title,
        },
      ],
    });
    await get().setSessionActiveProject({ sessionId: session.id, projectId: project.id });
    return session.id;
  };
};
