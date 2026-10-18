// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type {
  AgentId,
  MountId,
  ProjectId,
  PullRequestState,
  SessionId,
  StepId,
  WorkflowRunId,
} from '@goodboy/types';
import {
  deriveNextSteps,
  type SuggestionAgent,
  type SuggestionCheckChain,
  type SuggestionMount,
} from './deriveNextSteps';
import { isOfferedByActivity } from './isOfferedByActivity';
import type { FixChecksProgress, SessionSuggestion } from './types';

const sessionId: SessionId = JSON.parse(JSON.stringify('session-1'));
const mountId: MountId = JSON.parse(JSON.stringify('mount-web'));
const projectId: ProjectId = JSON.parse(JSON.stringify('project-web'));
const scoutId: AgentId = JSON.parse(JSON.stringify('agent-scout'));
const runId: WorkflowRunId = JSON.parse(JSON.stringify('run-1'));
const stepId: StepId = JSON.parse(JSON.stringify('step-2'));
const CHECK = 'payments-api / test';

const failingPr: PullRequestState = {
  number: 318,
  title: 'Prevent duplicate credits',
  url: 'https://github.com/harborline/payments-api/pull/318',
  state: 'open',
  mergeable: true,
  checks: 'failure',
  baseBranch: 'main',
  headBranch: 'acme/fix-credits',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-10T09:40:00.000Z',
};

const mount: SuggestionMount = {
  mountId,
  projectId,
  projectName: 'payments-api',
  branch: 'acme/fix-credits',
  worktreePath: '/tmp/payments-api',
  push: null,
  aheadOfBase: null,
  isClean: true,
  pr: failingPr,
  fetchedAt: null,
};

type ProgressParams = Partial<FixChecksProgress>;

const progressOf = ({
  chain = 'proposal',
  commit = null,
  commitCount = 0,
  outcome = null,
}: ProgressParams): FixChecksProgress => ({
  chain,
  checkName: CHECK,
  commit,
  commitCount,
  outcome,
});

const failedScout: SuggestionAgent = {
  id: scoutId,
  label: 'Scout',
  roleKind: 'scout',
  status: 'failed',
  workflowRunId: null,
  ordinal: 1,
  pendingSignal: null,
  isStoppedByRestart: false,
};

const RUNNING_ON_MOUNT: SuggestionAgent = { ...failedScout, status: 'running', mountId };

type StageParams = {
  readonly progress: FixChecksProgress | null;
  readonly hasRunningAgent?: boolean;
  readonly agents?: ReadonlyArray<SuggestionAgent>;
};

const nextOf = ({
  progress,
  hasRunningAgent = false,
  agents = [],
}: StageParams): ReadonlyArray<SessionSuggestion> => {
  const checkChains: ReadonlyArray<SuggestionCheckChain> =
    progress === null ? [] : [{ ...progress, mountId }];
  return deriveNextSteps({
    sessionId,
    workflowRuns: [],
    plans: [],
    consumedPlanIds: new Set(),
    openQuestionCount: 0,
    hasPullRequest: true,
    eligibleThreadCount: 0,
    projects: [],
    mountEvents: [],
    mounts: [mount],
    checkChains,
    agents: hasRunningAgent ? [...agents, RUNNING_ON_MOUNT] : agents,
  });
};

type FixChecksParams = {
  readonly progress?: FixChecksProgress;
};

const fixChecks = ({
  progress,
}: FixChecksParams): Extract<SessionSuggestion, { readonly kind: 'fix-checks' }> => ({
  id: `fix-checks:${mountId}`,
  kind: 'fix-checks',
  priority: 12,
  band: 1,
  title: 'Fix failing checks on #318',
  sessionId,
  targetKey: `pr:${mountId}`,
  fingerprint: `fix-checks:${mountId}:318`,
  payload: {
    mountId,
    projectName: 'payments-api',
    prNumber: 318,
    ...(progress !== undefined && { progress }),
  },
});

describe('Next leaves the follow-ups of a started run to its Activity row', () => {
  it('shows the first hint, then nothing from the analyze, open and fix chain', () => {
    expect(nextOf({ progress: null }).map((suggestion) => suggestion.title)).toEqual([
      'Fix failing checks on #318',
    ]);
    const stages: ReadonlyArray<StageParams> = [
      { progress: progressOf({ chain: 'analyzing' }), hasRunningAgent: true },
      { progress: progressOf({ chain: 'proposal' }) },
      { progress: progressOf({ chain: 'fixing' }), hasRunningAgent: true },
      { progress: progressOf({ chain: 'fixed-local', commit: '9e4c1a7', commitCount: 1 }) },
      {
        progress: progressOf({ chain: 'fixed-pushed', commitCount: 1, outcome: 'running' }),
      },
    ];
    for (const stage of stages) {
      expect(nextOf(stage)).toEqual([]);
    }
  });

  it('still shows a suggestion no Activity row offers', () => {
    const kinds = nextOf({
      progress: progressOf({ chain: 'proposal' }),
      agents: [failedScout],
    }).map((suggestion) => suggestion.kind);
    expect(kinds).toEqual(['retry-agent']);
  });

  it('keeps a new analysis once the pushed fix failed again', () => {
    expect(
      isOfferedByActivity({
        suggestion: fixChecks({
          progress: progressOf({ chain: 'fixed-pushed', commitCount: 1, outcome: 'failed' }),
        }),
      }),
    ).toBe(false);
    expect(
      isOfferedByActivity({
        suggestion: fixChecks({ progress: progressOf({ chain: 'no-fix' }) }),
      }),
    ).toBe(false);
    expect(isOfferedByActivity({ suggestion: fixChecks({}) })).toBe(false);
  });

  it('leaves the ready step of a run to the Start of its row', () => {
    expect(
      isOfferedByActivity({
        suggestion: {
          id: `workflow-next-step:${runId}`,
          kind: 'workflow-next-step',
          priority: 10,
          band: 1,
          title: 'Continue Build',
          sessionId,
          targetKey: `workflow-run:${runId}`,
          fingerprint: `workflow-next-step:${runId}:${stepId}`,
          payload: { runId, stepId },
        },
      }),
    ).toBe(true);
  });
});
