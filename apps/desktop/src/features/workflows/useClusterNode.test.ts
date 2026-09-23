// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type {
  Agent,
  AgentId,
  AgentStatus,
  ClusterCompletionHold,
  ClusterExecutionGraph,
  IsoDateTime,
  SessionId,
} from '@goodboy/types';
import { useAppStore } from '../../store';
import { useClusterNode } from './useClusterNode';

const SESSION_ID = 'session-1' as SessionId;
const CONTAINER_ID = 'container-1' as AgentId;
const NOW = '2026-09-23T00:00:00.000Z' as IsoDateTime;

const graph: ClusterExecutionGraph = {
  containerAgentId: CONTAINER_ID,
  sessionId: SESSION_ID,
  workflowRunId: null,
  planId: null,
  goalTitle: 'goal',
  graph: {
    executionVersion: 2,
    nodes: [
      {
        id: 'c0',
        ordinal: 0,
        title: 'Guard',
        instructions: 'restore the guard',
        role: 'implementer',
        dependsOn: [],
        expectedOutput: null,
      },
      {
        id: 'c1',
        ordinal: 1,
        title: 'Wire',
        instructions: 'wire the guard',
        role: 'implementer',
        dependsOn: ['c0'],
        expectedOutput: null,
      },
    ],
  },
  nodes: [
    {
      nodeId: 'c0',
      agentId: 'child-0' as AgentId,
      ordinal: 0,
      role: 'implementer',
      state: 'active',
      supersededBy: null,
      revision: 1,
      resultState: 'pending',
    },
    {
      nodeId: 'c1',
      agentId: 'child-1' as AgentId,
      ordinal: 1,
      role: 'implementer',
      state: 'active',
      supersededBy: null,
      revision: 1,
      resultState: 'pending',
    },
  ],
  revision: 1,
  frozenReason: null,
  frozenObligationId: null,
  createdAt: NOW,
};

const child = ({ id, status }: { readonly id: string; readonly status: AgentStatus }): Agent => ({
  id: id as AgentId,
  sessionId: SESSION_ID,
  parentAgentId: CONTAINER_ID,
  ordinal: 0,
  name: id,
  status,
});

const holdOn = (state: ClusterCompletionHold['state']): ClusterCompletionHold => ({
  id: 'hold-0',
  sessionId: SESSION_ID,
  workflowRunId: null,
  containerAgentId: CONTAINER_ID,
  sourceAgentId: 'child-0' as AgentId,
  sourceTurnId: 'turn-0',
  reason: 'unresolved-outcome',
  findings: [],
  state,
  resolutionEvidence: state === 'resolved' ? 'repair verified' : null,
  resolvedAt: state === 'resolved' ? NOW : null,
  createdAt: NOW,
  updatedAt: NOW,
});

const pendingTitles = (): ReadonlyArray<string> | undefined =>
  renderHook(() => useClusterNode({ sessionId: SESSION_ID, agentId: 'child-1' as AgentId })).result
    .current?.pendingDependencyTitles;

afterEach(cleanup);

beforeEach(() => {
  useAppStore.setState({
    clusterExecutionGraphs: { [SESSION_ID]: [graph] },
    clusterCompletionHolds: {},
    sessionPhaseRuns: {},
  });
});

describe('useClusterNode', () => {
  it('keeps a node waiting on a transferred dependency whose hold is still open', () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION_ID]: [
          child({ id: 'child-0', status: 'transferred' }),
          child({ id: 'child-1', status: 'pending' }),
        ],
      },
      clusterCompletionHolds: { [SESSION_ID]: [holdOn('open')] },
    });

    expect(pendingTitles()).toEqual(['Guard']);
  });

  it('stops waiting once a transferred dependency completed its node through a resolved hold', () => {
    useAppStore.setState({
      sessionPhaseRuns: {
        [SESSION_ID]: [
          child({ id: 'child-0', status: 'transferred' }),
          child({ id: 'child-1', status: 'pending' }),
        ],
      },
      clusterCompletionHolds: { [SESSION_ID]: [holdOn('resolved')] },
    });

    expect(pendingTitles()).toEqual([]);
  });

  it('stops waiting on a removed dependency whose hold was resolved', () => {
    useAppStore.setState({
      sessionPhaseRuns: { [SESSION_ID]: [child({ id: 'child-1', status: 'pending' })] },
      clusterCompletionHolds: { [SESSION_ID]: [holdOn('resolved')] },
    });

    expect(pendingTitles()).toEqual([]);
  });
});
