// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentId, MountId, ProjectId, PullRequestState, SessionId } from '@goodboy/types';
import {
  deriveNextSteps,
  type SuggestionAgent,
  type SuggestionCheckChain,
  type SuggestionMount,
} from './deriveNextSteps';
import type { SessionSuggestion } from './types';

const sessionId: SessionId = JSON.parse(JSON.stringify('session-1'));
const mountId: MountId = JSON.parse(JSON.stringify('mount-web'));
const projectId: ProjectId = JSON.parse(JSON.stringify('project-web'));
const agentId: AgentId = JSON.parse(JSON.stringify('agent-1'));
const CHECK = 'payments-api / test';

const BASE_PARAMS = {
  sessionId,
  workflowRuns: [],
  plans: [],
  consumedPlanIds: new Set<never>(),
  openQuestionCount: 0,
  hasPullRequest: false,
  eligibleThreadCount: 0,
  mountEvents: [],
  projects: [],
};

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

const mount = (overrides: Partial<SuggestionMount> = {}): SuggestionMount => ({
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
  ...overrides,
});

const chain = (overrides: Partial<SuggestionCheckChain>): SuggestionCheckChain => ({
  mountId,
  checkName: CHECK,
  chain: 'proposal',
  commit: null,
  commitCount: 0,
  outcome: null,
  ...overrides,
});

const agent = (overrides: Partial<SuggestionAgent> = {}): SuggestionAgent => ({
  id: agentId,
  label: 'Implementer',
  roleKind: 'implementer',
  status: 'completed',
  workflowRunId: null,
  ordinal: 1,
  pendingSignal: null,
  isStoppedByRestart: false,
  ...overrides,
});

type DeriveParams = {
  readonly chains?: ReadonlyArray<SuggestionCheckChain>;
  readonly agents?: ReadonlyArray<SuggestionAgent>;
  readonly mounts?: ReadonlyArray<SuggestionMount>;
};

const cardOf = ({
  chains = [],
  agents = [],
  mounts = [mount()],
}: DeriveParams): SessionSuggestion | undefined =>
  deriveNextSteps({ ...BASE_PARAMS, mounts, checkChains: chains, agents }).find(
    (suggestion) => suggestion.kind === 'fix-checks',
  );

describe('the failing-checks card by chain state', () => {
  it('offers the first hint with no analysis and after an analysis without a fix', () => {
    expect(cardOf({})?.title).toBe('Fix failing checks on #318');
    expect(cardOf({ chains: [chain({ chain: 'no-fix' })] })?.title).toBe(
      'Fix failing checks on #318',
    );
  });
  it('waits while an agent runs on the same branch', () => {
    expect(cardOf({ agents: [agent({ status: 'running', mountId })] })).toBeUndefined();
  });
  it('stays while an agent runs on another branch', () => {
    const other: MountId = JSON.parse(JSON.stringify('mount-other'));
    expect(cardOf({ agents: [agent({ status: 'running', mountId: other })] })).toBeDefined();
  });
  it('hides while an agent without a mount runs in a one mount session', () => {
    expect(cardOf({ agents: [agent({ status: 'running' })] })).toBeUndefined();
  });
  it.each([
    { name: 'analyzing', progress: { chain: 'analyzing' as const } },
    { name: 'proposal', progress: { chain: 'proposal' as const } },
    { name: 'fixing', progress: { chain: 'fixing' as const } },
    { name: 'fixed-local', progress: { chain: 'fixed-local' as const, commitCount: 1 } },
    { name: 'fix-failed', progress: { chain: 'fix-failed' as const } },
    {
      name: 'fixed-pushed while the check runs',
      progress: { chain: 'fixed-pushed' as const, commitCount: 1, outcome: 'running' as const },
    },
    {
      name: 'fixed-pushed once the check passed',
      progress: { chain: 'fixed-pushed' as const, commitCount: 1, outcome: 'passed' as const },
    },
  ])('leaves the $name follow-up to the Activity row of the run', ({ progress }) => {
    expect(cardOf({ chains: [chain(progress)] })).toBeUndefined();
    expect(
      cardOf({ chains: [chain(progress)], agents: [agent({ status: 'running', mountId })] }),
    ).toBeUndefined();
  });
  it('shows no card once the checks no longer fail and nothing was pushed', () => {
    expect(
      cardOf({
        chains: [chain({ chain: 'fixed-local', commitCount: 1 })],
        mounts: [mount({ pr: { ...failingPr, checks: 'pending' } })],
      }),
    ).toBeUndefined();
  });
  it('offers a new analysis when the check still fails after the push', () => {
    const card = cardOf({
      chains: [chain({ chain: 'fixed-pushed', commitCount: 1, outcome: 'failed' })],
    });
    expect(card?.title).toBe(`${CHECK} still fails on #318`);
    expect(card?.detail).toContain('Nothing runs by itself.');
    expect(card?.fingerprint).toBe('fix-checks:mount-web:318:fixed-pushed:failed');
  });
  it('keeps the plain push card out while the fix waits for the Push on its Activity row', () => {
    const push = { kind: 'ahead', ahead: 1 } as const;
    const waiting = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [mount({ push })],
      checkChains: [chain({ chain: 'fixed-local', commit: '9e4c1a7', commitCount: 1 })],
    });
    expect(waiting).toEqual([]);
    const without = deriveNextSteps({ ...BASE_PARAMS, mounts: [mount({ push })] });
    expect(without.map((suggestion) => suggestion.kind)).toContain('push-branch');
  });
});

describe('the generic review card', () => {
  it('does not fire for the Implementer a failed check started', () => {
    const suggestions = deriveNextSteps({
      ...BASE_PARAMS,
      agents: [agent({ sourceKind: 'failed_check' })],
    });
    expect(suggestions.some((suggestion) => suggestion.kind === 'check-changes')).toBe(false);
  });
  it('still fires for a normal Implementer', () => {
    const suggestions = deriveNextSteps({ ...BASE_PARAMS, agents: [agent()] });
    expect(suggestions.map((suggestion) => suggestion.kind)).toEqual(['check-changes']);
  });
});
