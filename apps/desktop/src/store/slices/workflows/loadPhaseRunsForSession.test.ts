import { describe, expect, it, vi } from 'vitest';
import type { AgentId, SessionId } from '@goodboy/types';
import type { AppStore } from '../../store';
import type { SetFn } from './types';

const invokeSpy = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { loadPhaseRunsForSession } from './loadPhaseRunsForSession';

const SESSION_ID = 'ses-1' as SessionId;

const agentRow = (id: string) => ({
  id,
  sessionId: SESSION_ID,
  stepId: null,
  workflowRunId: null,
  parentAgentId: null,
  ordinal: 0,
  name: 'scout',
  status: 'pending',
  providerRunId: null,
  outputSummary: null,
  startedAt: null,
  completedAt: null,
  providerSessionId: null,
  lastFinishedAt: null,
  lastViewedAt: null,
  doneAt: null,
  kind: 'scout',
  verbosity: null,
  effort: 'high',
  modelOverride: 'claude-opus-5',
  providerOverride: 'anthropic',
  sourceThreadId: null,
  sourceThreadIds: null,
  sourceCommentUrl: null,
  sourceKind: null,
  domainsJson: null,
});

const makeStore = (initial: Partial<AppStore>) => {
  let state = initial;
  const set: SetFn = (update) => {
    const patch = typeof update === 'function' ? update(state as AppStore) : update;
    state = { ...state, ...patch };
  };
  return { set, getState: () => state };
};

const respondWith = ({
  agents,
  holds,
  grants = [],
}: {
  readonly agents: ReadonlyArray<unknown>;
  readonly holds: ReadonlyArray<unknown>;
  readonly grants?: ReadonlyArray<unknown>;
}) => {
  invokeSpy.mockImplementation(async (command: string) => {
    if (command === 'db_select') {
      return [];
    }
    if (command === 'cluster_completion_holds_for_session') {
      return holds;
    }
    if (command === 'cluster_execution_graphs_for_session') {
      return [];
    }
    if (command === 'capability_obligations_for_session') {
      return [];
    }
    if (command === 'capability_grants_for_session') {
      return grants;
    }
    return agents;
  });
};

describe('loadPhaseRunsForSession', () => {
  it('preserves a spawned agent provider, model and effort after a refresh', async () => {
    respondWith({ agents: [agentRow('agent-new')], holds: [] });
    const { set, getState } = makeStore({ sessionPhaseRuns: {} });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().sessionPhaseRuns?.[SESSION_ID]?.[0]).toMatchObject({
      providerOverride: 'anthropic',
      modelOverride: 'claude-opus-5',
      effort: 'high',
    });
  });

  it('seeds the agent override maps from the persisted rows', async () => {
    respondWith({ agents: [agentRow('agent-new')], holds: [] });
    const { set, getState } = makeStore({
      sessionPhaseRuns: {},
      agentModelOverride: {},
      agentProviderOverride: {},
      agentEffortOverride: {},
    });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().agentModelOverride).toEqual({ 'agent-new': 'claude-opus-5' });
    expect(getState().agentProviderOverride).toEqual({ 'agent-new': 'anthropic' });
    expect(getState().agentEffortOverride).toEqual({ 'agent-new': 'high' });
  });

  it('keeps fresher in-memory overrides over the persisted rows', async () => {
    respondWith({ agents: [agentRow('agent-new')], holds: [] });
    const { set, getState } = makeStore({
      sessionPhaseRuns: {},
      agentModelOverride: { ['agent-new' as AgentId]: 'claude-sonnet-4-6' },
      agentProviderOverride: { ['agent-new' as AgentId]: 'cursor' },
      agentEffortOverride: { ['agent-new' as AgentId]: 'low' },
    });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().agentModelOverride).toEqual({ 'agent-new': 'claude-sonnet-4-6' });
    expect(getState().agentProviderOverride).toEqual({ 'agent-new': 'cursor' });
    expect(getState().agentEffortOverride).toEqual({ 'agent-new': 'low' });
  });

  it('restores a capability grant when the session reloads', async () => {
    respondWith({
      agents: [agentRow('agent-new')],
      holds: [],
      grants: [
        {
          id: 'grant-1',
          obligationId: 'obligation-1',
          sessionId: SESSION_ID,
          workflowRunId: null,
          grantedRole: 'implementer',
          purpose: 'repair',
          continuation: 'handoff',
          parentOutcome: 'handed-off',
          childAgentId: 'agent-new',
          replacementAgentId: null,
          verificationAgentId: null,
          transferredWork: null,
          state: 'delivered',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const { set, getState } = makeStore({ sessionPhaseRuns: {}, capabilityGrants: {} });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().capabilityGrants?.[SESSION_ID]?.[0]).toMatchObject({
      id: 'grant-1',
      obligationId: 'obligation-1',
      childAgentId: 'agent-new',
      state: 'delivered',
    });
  });

  it('restores completion holds when the session reloads', async () => {
    respondWith({
      agents: [agentRow('agent-new')],
      holds: [
        {
          id: 'hold-1',
          sessionId: SESSION_ID,
          workflowRunId: null,
          containerAgentId: 'container',
          sourceAgentId: 'agent-new',
          sourceTurnId: 'turn-1',
          reason: 'missing-outcome',
          findingsJson: '[]',
          state: 'open',
          resolutionEvidence: null,
          resolvedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const { set, getState } = makeStore({
      sessionPhaseRuns: {},
      clusterCompletionHolds: {},
    });

    await loadPhaseRunsForSession(set)(SESSION_ID);

    expect(getState().clusterCompletionHolds?.[SESSION_ID]?.[0]).toMatchObject({
      id: 'hold-1',
      state: 'open',
      reason: 'missing-outcome',
    });
  });
});
