// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { AgentId, ClusterExecutionEligibility, SessionId } from '@goodboy/types';

const { state } = vi.hoisted(() => ({
  state: {
    clusterExecutionEligibility: {} as Record<string, ReadonlyArray<ClusterExecutionEligibility>>,
  },
}));

vi.mock('../../../../store', () => ({
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { ClusterExecutionEligibilityNote } from './index';

const sessionId = 'session-1' as SessionId;
const containerAgentId = 'container-1' as AgentId;

const eligibility = (
  overrides: Partial<ClusterExecutionEligibility>,
): ClusterExecutionEligibility => ({
  containerAgentId,
  sessionId,
  graphRevision: 1,
  state: 'sequential',
  reason:
    'the session checkout has uncommitted changes (2 untracked), so every cluster runs one at a time',
  targetMountId: null,
  targetHeadSha: null,
  evaluatedAt: '2026-09-23T00:00:00.000Z' as ClusterExecutionEligibility['evaluatedAt'],
  ...overrides,
});

afterEach(cleanup);

describe('ClusterExecutionEligibilityNote', () => {
  it('shows why an execution stays sequential', () => {
    state.clusterExecutionEligibility = { [sessionId]: [eligibility({})] };

    render(
      <ClusterExecutionEligibilityNote sessionId={sessionId} containerAgentId={containerAgentId} />,
    );

    expect(screen.getByTestId(`cluster-sequential-${containerAgentId}`).textContent).toContain(
      '2 untracked',
    );
  });

  it('stays silent for an eligible execution and a legacy graph', () => {
    state.clusterExecutionEligibility = {
      [sessionId]: [eligibility({ state: 'eligible', reason: null })],
    };
    const { container, rerender } = render(
      <ClusterExecutionEligibilityNote sessionId={sessionId} containerAgentId={containerAgentId} />,
    );
    expect(container.textContent).toBe('');

    state.clusterExecutionEligibility = {};
    rerender(
      <ClusterExecutionEligibilityNote sessionId={sessionId} containerAgentId={containerAgentId} />,
    );
    expect(container.textContent).toBe('');
  });
});
