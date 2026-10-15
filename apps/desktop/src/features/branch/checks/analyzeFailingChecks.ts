import type {
  AgentId,
  MountId,
  PrCheckRun,
  PullRequestState,
  PullRequestView,
  SessionId,
} from '@goodboy/types';
import type { AgentKindRouting } from '../../session/agent-kind';
import { useAppStore } from '../../../store';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';
import { selectCheckAnalysis } from '../../../store/slices/agents/selectCheckAnalysis';
import { tauriGhRunner } from '../../integrations/github/github';
import { worktreeChangedFiles } from '../../worktree/worktree';
import { buildAnalyzeChecksPrompt } from './buildAnalyzeChecksPrompt';
import { checkAnalysisOf } from './checkAnalysisOf';
import { checkRoutingOf } from './checkRoutingOf';
import { ciFixName } from './ciFixName';
import { fetchFailedCheckLog } from './fetchFailedCheckLog';

type Params = {
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly pullRequest: PullRequestState | PullRequestView;
  readonly checks: ReadonlyArray<PrCheckRun>;
  readonly routing?: AgentKindRouting;
  readonly hint?: string;
  readonly onAccepted?: () => void;
};

const ALREADY_ANALYZING = 'A Debugger is already analyzing this check. Your hint was not applied.';

const pending = new Map<string, Promise<AgentId>>();

const start = async ({
  sessionId,
  mountId,
  pullRequest,
  checks,
  routing,
  hint = '',
  onAccepted,
}: Params): Promise<AgentId> => {
  const state = useAppStore.getState();
  const session = sessionById(state.sessions, sessionId);
  const repo = resolveSessionRepo({ state, sessionId, mountId });
  if (session === undefined || repo === null || checks.length === 0) {
    throw new Error('The branch or failing checks are no longer available. Refresh and try again.');
  }
  const firstUrl = checks[0]?.detailsUrl ?? pullRequest.url;
  const previous = selectCheckAnalysis({ state, sessionId, url: firstUrl });
  if (
    previous !== null &&
    checkAnalysisOf({
      agent: previous,
      events: state.transcripts[previous.id] ?? [],
      turnState: state.agentTurnState[previous.id],
    }).isRunning
  ) {
    if (hint.trim().length > 0) {
      throw new Error(ALREADY_ANALYZING);
    }
    return previous.id;
  }
  const resolved = checkRoutingOf({ state, sessionId, mountId });
  if (resolved.isBlocked && routing === undefined) {
    throw new Error('Show a model for the Debugger in Settings, or choose one before analyzing.');
  }
  const target = {
    cwd: repo.worktreePath,
    workspaceId: session.workspaceId,
    projectId: repo.projectId,
  };
  const logs = await Promise.all(
    checks.map(async (check) => ({ check, log: await fetchFailedCheckLog({ check, ...target }) })),
  );
  let paths: ReadonlyArray<string> = [];
  if (new URL(pullRequest.url).hostname === 'github.com') {
    const files = await tauriGhRunner.run(
      ['pr', 'view', pullRequest.url, '--json', 'files', '--jq', '.files[].path'],
      target,
    );
    if (files.exitCode !== 0) {
      throw new Error('Could not read the pull request paths. Refresh and try Analyze again.');
    }
    paths = files.stdout.split('\n').filter((path) => path.length > 0);
  }
  if (new URL(pullRequest.url).hostname !== 'github.com') {
    paths = (
      await worktreeChangedFiles({
        worktreePath: repo.worktreePath,
        baseBranch: pullRequest.baseBranch,
      })
    ).paths;
  }
  return state.spawnAgent(sessionId, {
    kindOverride: 'ci-debugger',
    name: ciFixName({ check: checks[0], pullRequest }),
    initialPrompt: buildAnalyzeChecksPrompt({
      pullRequest,
      checks: logs.map(({ check, log }) => ({ ...check, log })),
      paths,
      hint,
    }),
    sourceKind: 'failed_check',
    sourceCommentUrl: firstUrl,
    mountId,
    focus: 'none',
    provider: routing?.provider ?? resolved.provider,
    model: routing?.model ?? resolved.model,
    effort: routing?.effort ?? resolved.effort,
    ...(onAccepted !== undefined && { onKickoffAccepted: onAccepted }),
  });
};

export const analyzeFailingChecks = ({
  sessionId,
  mountId,
  pullRequest,
  checks,
  routing,
  hint = '',
  onAccepted,
}: Params): Promise<AgentId> => {
  const key = JSON.stringify([sessionId, mountId, checks[0]?.detailsUrl ?? pullRequest.url]);
  const existing = pending.get(key);
  if (existing !== undefined) {
    if (hint.trim().length > 0) {
      return Promise.reject(new Error(ALREADY_ANALYZING));
    }
    return existing;
  }
  const result = start({
    sessionId,
    mountId,
    pullRequest,
    checks,
    ...(routing !== undefined && { routing }),
    hint,
    ...(onAccepted !== undefined && { onAccepted }),
  }).finally(() => pending.delete(key));
  pending.set(key, result);
  return result;
};
