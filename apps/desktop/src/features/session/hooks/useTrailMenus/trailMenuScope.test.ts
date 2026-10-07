import { describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
}));

import { createTrailMenuScope } from './trailMenuScope';
import type { TrailMenuInputs } from './trailMenuInputs';

const SESSION_ID = 'session-1' as SessionId;

const agent = (overrides: Partial<Agent> & Pick<Agent, 'id'>): Agent =>
  anAgent({ sessionId: SESSION_ID, name: overrides.id, status: 'completed', ...overrides });

const root = agent({ id: 'agent-root' as AgentId, status: 'running' });
const middle = agent({ id: 'agent-middle' as AgentId, parentAgentId: root.id });
const leaf = agent({ id: 'agent-leaf' as AgentId, parentAgentId: middle.id, status: 'running' });
const resolver = agent({ id: 'agent-resolver' as AgentId, kind: 'resolver' });

const inputsFor = (overrides: Partial<TrailMenuInputs>): TrailMenuInputs => ({
  session: aSession({ id: SESSION_ID }),
  sessionId: SESSION_ID,
  selectedAgentId: null,
  phaseRuns: [root, middle, leaf, resolver],
  kindOverride: {},
  focusedWorkflowRunId: null,
  focusedArtifactId: null,
  artifacts: [],
  resolveAttempts: [],
  navigate: vi.fn(),
  setFocusedWorkflowRun: vi.fn(),
  setFocusedArtifactId: vi.fn(),
  cancelCurrentTurn: vi.fn(),
  recoverStuckStep: vi.fn(),
  reportError: vi.fn(),
  workspaceSlug: null,
  signals: { openQuestionAgentIds: new Set(), liveTurnAgentIds: new Set() },
  attachedRuns: [],
  selectedWorkflowRun: null,
  destinations: [],
  summaries: {},
  mounts: [],
  diffPath: null,
  diffStats: new Map(),
  branchStatuses: new Map(),
  mergedMountIds: [],
  openRequestHeads: {},
  queueRows: [],
  resolveAgain: vi.fn(),
  prNumber: null,
  selectedPrNumber: null,
  pullRequests: [],
  selectSessionPr: vi.fn(),
  setPullRequestMode: vi.fn(),
  threadId: null,
  copy: vi.fn(),
  ...overrides,
});

describe('createTrailMenuScope', () => {
  it('has no selected, parent or root without a selected agent', () => {
    const scope = createTrailMenuScope(inputsFor({}));
    expect([scope.selected, scope.parent, scope.root]).toEqual([null, null, null]);
  });

  it('has neither parent nor root for a top level agent', () => {
    const scope = createTrailMenuScope(inputsFor({ selectedAgentId: root.id }));
    expect(scope.selected).toBe(root);
    expect([scope.parent, scope.root]).toEqual([null, null]);
  });

  it('has a parent but no root one level down', () => {
    const scope = createTrailMenuScope(inputsFor({ selectedAgentId: middle.id }));
    expect(scope.parent).toBe(root);
    expect(scope.root).toBeNull();
  });

  it('walks up to the root from two levels down', () => {
    const scope = createTrailMenuScope(inputsFor({ selectedAgentId: leaf.id }));
    expect(scope.parent).toBe(middle);
    expect(scope.root).toBe(root);
  });

  it('collects the resolver agents and honours a kind override', () => {
    const plain = createTrailMenuScope(inputsFor({}));
    expect([...plain.resolvers]).toEqual([resolver.id]);
    const overridden = createTrailMenuScope(inputsFor({ kindOverride: { [root.id]: 'resolver' } }));
    expect(overridden.resolvers.has(root.id)).toBe(true);
  });

  it('words a finished agent Running while one of its children still runs', () => {
    const withChild = createTrailMenuScope(inputsFor({}));
    expect(withChild.stateOf(middle).word).toBe('Running');
    const alone = createTrailMenuScope(inputsFor({ phaseRuns: [middle] }));
    expect(alone.stateOf(middle).word).toBe('Done');
  });

  it('words an agent with an open question Needs you', () => {
    const scope = createTrailMenuScope(
      inputsFor({
        signals: { openQuestionAgentIds: new Set([root.id]), liveTurnAgentIds: new Set() },
      }),
    );
    expect(scope.stateOf(root).word).toBe('Needs you');
  });

  it('names the role label of an agent from its kind', () => {
    const scope = createTrailMenuScope(inputsFor({}));
    expect(scope.roleOf(resolver).label).toBe('Resolver');
  });

  it('navigates to the agent place of the session', () => {
    const navigate = vi.fn();
    const scope = createTrailMenuScope(inputsFor({ navigate }));
    scope.toAgent(leaf.id);
    expect(navigate).toHaveBeenCalledWith({
      to: { at: 'agent', sessionId: SESSION_ID, agentId: leaf.id },
    });
  });
});
