import type { SessionId } from '@goodboy/types';
import type { AppState } from '../../types';
import type { LensKind } from '../session-view/types';
import { EMPTY_FOCUS, type Focus, type Location, type SessionTarget } from './types';

const ISSUE_LENSES: ReadonlySet<LensKind> = new Set<LensKind>([
  'linear',
  'gitlab_issues',
  'jira_issues',
  'slack_threads',
  'pr',
]);

type TargetParams = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly lens: LensKind | null;
};

const captureTarget = ({ state, sessionId, lens }: TargetParams): SessionTarget | null => {
  if (lens === 'plans') {
    const artifactId = state.focusedArtifactId[sessionId] ?? null;
    return artifactId === null ? null : { kind: 'artifact', artifactId };
  }
  if (lens === 'workflows') {
    const runId = state.focusedWorkflowRunId[sessionId] ?? null;
    return runId === null ? null : { kind: 'run', runId };
  }
  if (lens === 'github_issue') {
    const issueNumber = state.focusedGithubIssueNumber[sessionId] ?? null;
    return issueNumber === null ? null : { kind: 'github-issue', issueNumber };
  }
  if (lens === 'files') {
    const mountPath = state.diffMountPath[sessionId] ?? null;
    const focus = state.diffFocus[sessionId] ?? null;
    return mountPath === null && focus === null ? null : { kind: 'diff', mountPath, focus };
  }
  if (lens === 'terminal') {
    const mountPath = state.terminalMountPath[sessionId] ?? null;
    return mountPath === null ? null : { kind: 'terminal', mountPath };
  }
  if (lens === null || !ISSUE_LENSES.has(lens)) {
    return null;
  }
  const task = state.focusedExternalTask[sessionId] ?? null;
  return task === null ? null : { kind: 'external-task', task };
};

type Params = {
  readonly state: AppState;
  readonly focus?: Focus;
};

export const captureLocation = ({ state, focus: base = EMPTY_FOCUS }: Params): Location => {
  const workspaceId = state.currentWorkspaceId;
  const focus: Focus = { ...base, drawer: state.drawer };
  const sessionId = state.currentSessionId;
  if (sessionId === null) {
    return { workspaceId, place: { at: 'board' }, studio: state.appStudio, focus };
  }
  const lens = state.activeLens[sessionId] ?? null;
  const studio = state.sessionStudio[sessionId] ?? null;
  return {
    workspaceId,
    place: {
      at: 'session',
      sessionId,
      view: {
        lens,
        agentId: studio === null ? (state.selectedAgentId[sessionId] ?? null) : null,
        studio,
        target: captureTarget({ state, sessionId, lens }),
      },
    },
    studio: state.appStudio,
    focus,
  };
};
