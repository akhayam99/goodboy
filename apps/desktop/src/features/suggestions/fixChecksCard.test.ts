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
  readonly hasRunningAgent?: boolean;
  readonly mounts?: ReadonlyArray<SuggestionMount>;
};

const cardOf = ({
  chains = [],
  hasRunningAgent = false,
  mounts = [mount()],
}: DeriveParams): SessionSuggestion | undefined =>
  deriveNextSteps({ ...BASE_PARAMS, mounts, checkChains: chains, hasRunningAgent }).find(
    (suggestion) => suggestion.kind === 'fix-checks',
  );

describe('the failing-checks card by chain state', () => {
  it('keeps the generic title with no analysis', () => {
    expect(cardOf({})?.title).toBe('Fix failing checks on #318');
    expect(cardOf({ chains: [chain({ chain: 'proposal' })] })?.title).toBe(
      'Fix failing checks on #318',
    );
  });
  it('says what is running while the Debugger analyzes, even with an agent running', () => {
    const card = cardOf({ chains: [chain({ chain: 'analyzing' })], hasRunningAgent: true });
    expect(card?.title).toBe(`Analyzing ${CHECK} on #318`);
    expect(card?.detail).toBe('payments-api · reading the failed log');
  });
  it('says what is running while the Implementer fixes, even with an agent running', () => {
    const card = cardOf({ chains: [chain({ chain: 'fixing' })], hasRunningAgent: true });
    expect(card?.title).toBe(`Fixing ${CHECK} on #318`);
  });
  it('hides a finished state while another agent runs', () => {
    expect(
      cardOf({
        chains: [chain({ chain: 'fixed-local', commit: '9e4c1a7', commitCount: 1 })],
        hasRunningAgent: true,
      }),
    ).toBeUndefined();
  });
  it('turns into a success card when the fix is committed and not pushed', () => {
    const card = cardOf({
      chains: [chain({ chain: 'fixed-local', commit: '9e4c1a7', commitCount: 1 })],
    });
    expect(card?.title).toBe(`${CHECK} is fixed on your branch`);
    expect(card?.detail).toBe('1 commit is ready. Push it so the check runs again.');
  });
  it('writes the plural for several commits', () => {
    const card = cardOf({
      chains: [chain({ chain: 'fixed-local', commit: '9e4c1a7', commitCount: 2 })],
    });
    expect(card?.detail).toBe('2 commits are ready. Push them so the check runs again.');
  });
  it('says the check is running again after the push', () => {
    const card = cardOf({
      chains: [chain({ chain: 'fixed-pushed', commit: '9e4c1a7', commitCount: 1 })],
    });
    expect(card?.title).toBe(`${CHECK} is running again on #318`);
    expect(card?.detail).toBe('payments-api · 1 commit pushed');
  });
  it('says the fix made no commit when it stopped', () => {
    const card = cardOf({ chains: [chain({ chain: 'fix-failed' })] });
    expect(card?.detail).toBe('payments-api · the fix ended without a commit');
  });
  it('gives each state its own fingerprint so Not now on one does not hide the next', () => {
    const fingerprints = (['analyzing', 'fixing', 'fixed-local', 'fixed-pushed'] as const).map(
      (state) => cardOf({ chains: [chain({ chain: state, commitCount: 1 })] })?.fingerprint,
    );
    expect(new Set(fingerprints).size).toBe(4);
  });
  it('shows no card once the checks no longer fail and nothing was pushed', () => {
    expect(
      cardOf({
        chains: [chain({ chain: 'fixed-local', commitCount: 1 })],
        mounts: [mount({ pr: { ...failingPr, checks: 'pending' } })],
      }),
    ).toBeUndefined();
  });
  it('keeps the card after the push while the checks run', () => {
    const card = cardOf({
      chains: [chain({ chain: 'fixed-pushed', commitCount: 1, outcome: 'running' })],
      mounts: [mount({ pr: { ...failingPr, checks: 'pending' } })],
    });
    expect(card?.title).toBe(`${CHECK} is running again on #318`);
  });
  it('reports a passed check after the push', () => {
    const card = cardOf({
      chains: [chain({ chain: 'fixed-pushed', commitCount: 1, outcome: 'passed' })],
      mounts: [mount({ pr: { ...failingPr, checks: 'success' } })],
    });
    expect(card?.title).toBe(`${CHECK} passed on #318`);
    expect(card?.detail).toBe('payments-api · the fix worked. This clears by itself in a while.');
  });
  it('reports a check that still fails and runs nothing by itself', () => {
    const card = cardOf({
      chains: [chain({ chain: 'fixed-pushed', commitCount: 1, outcome: 'failed' })],
    });
    expect(card?.title).toBe(`${CHECK} still fails on #318`);
    expect(card?.detail).toContain('Nothing runs by itself.');
  });
  it('replaces the plain push card while the fix waits for a push', () => {
    const push = { kind: 'ahead', ahead: 1 } as const;
    const withCard = deriveNextSteps({
      ...BASE_PARAMS,
      mounts: [mount({ push })],
      checkChains: [chain({ chain: 'fixed-local', commit: '9e4c1a7', commitCount: 1 })],
    });
    expect(withCard.map((suggestion) => suggestion.kind)).toEqual(['fix-checks']);
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
