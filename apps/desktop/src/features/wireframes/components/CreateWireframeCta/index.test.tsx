// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    sessionPhaseRuns: {} as Record<string, ReadonlyArray<Record<string, unknown>>>,
    summarizerStatus: {} as Record<string, { readonly status: string }>,
    agentTurnState: {} as Record<string, { readonly kind: string }>,
    spawnWireframeAgent: vi.fn(async () => 'agent-wireframe'),
  },
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: [] as readonly never[],
  useAppStore: <T,>(selector: (s: typeof state) => T) => selector(state),
}));

import { CreateWireframeCta } from './index';

const SESSION_ID = JSON.parse(JSON.stringify('session-1'));

const completedAgent = {
  id: 'agent-1',
  sessionId: SESSION_ID,
  ordinal: 0,
  name: 'implementer',
  status: 'completed',
  workflowRunId: null,
};

beforeEach(() => {
  state.sessionPhaseRuns = { [SESSION_ID]: [completedAgent] };
  state.summarizerStatus = {};
  state.agentTurnState = {};
  state.spawnWireframeAgent.mockClear();
});
afterEach(cleanup);

describe('CreateWireframeCta', () => {
  it('is blocked while nothing has run', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [] };
    render(<CreateWireframeCta sessionId={SESSION_ID} />);
    const trigger = screen.getByTestId('create-wireframe-cta');
    expect(trigger.hasAttribute('disabled')).toBe(true);
    expect(trigger.getAttribute('title')).toContain('nothing has run yet');
  });

  it('is blocked while an agent is still live', () => {
    state.sessionPhaseRuns = { [SESSION_ID]: [{ ...completedAgent, status: 'running' }] };
    render(<CreateWireframeCta sessionId={SESSION_ID} />);
    expect(screen.getByTestId('create-wireframe-cta').hasAttribute('disabled')).toBe(true);
  });

  it('names the repository styled option for what it does and spawns it as high', async () => {
    render(<CreateWireframeCta sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByTestId('create-wireframe-cta'));
    expect(screen.getByText('Plain wireframe')).toBeDefined();
    expect(screen.getByText('Repository styled wireframe')).toBeDefined();
    expect(
      screen.getByText(/no style evidence it says so and uses the generic theme/),
    ).toBeDefined();
    fireEvent.click(screen.getByText('Repository styled wireframe'));
    await waitFor(() => {
      expect(state.spawnWireframeAgent).toHaveBeenCalledWith({
        sessionId: SESSION_ID,
        fidelity: 'high',
        workflowRunId: null,
      });
    });
  });

  it('surfaces a spawn failure inline', async () => {
    state.spawnWireframeAgent.mockRejectedValueOnce(new Error('no provider is connected'));
    render(<CreateWireframeCta sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByTestId('create-wireframe-cta'));
    fireEvent.click(screen.getByText('Plain wireframe'));
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('no provider is connected');
    });
  });
});
