// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import { lensGo, setActiveLens } from '../../../store/slices/session-view/workSurface';
import type { GetFn, SetFn } from '../../../store/slices/session-view/types';

const SESSION_ID = 'ses-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;

type State = Record<string, unknown>;

const state: State = {};

const set = ((updater: unknown) => {
  const patch = typeof updater === 'function' ? (updater as (s: State) => State)(state) : updater;
  Object.assign(state, patch);
}) as unknown as SetFn;

const get = (() => state) as unknown as GetFn;

vi.mock('../../../store', () => ({
  useAppStore: <T,>(selector: (s: State) => T) => selector(state),
}));

import { WorkSurfaceBackButton } from './index';

const reset = () => {
  for (const key of Object.keys(state)) {
    delete state[key];
  }
  Object.assign(state, {
    activeLens: {},
    selectedAgentId: {},
    sessionStudio: {},
    diffFocus: {},
    focusedWorkflowRunId: {},
    lensHistory: {},
    sessionPhaseRuns: { [SESSION_ID]: [{ id: AGENT_ID }] },
    lensGo: lensGo(set, get),
  });
};

afterEach(cleanup);

describe('WorkSurfaceBackButton', () => {
  it('stays hidden when nothing preceded the current position', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'workflows');

    render(<WorkSurfaceBackButton sessionId={SESSION_ID} />);

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('restores the agent chat the app moved the operator away from', () => {
    reset();
    setActiveLens(set)(SESSION_ID, 'agents');
    (state['selectedAgentId'] as Record<string, AgentId>)[SESSION_ID] = AGENT_ID;
    setActiveLens(set)(SESSION_ID, 'workflows');

    render(<WorkSurfaceBackButton sessionId={SESSION_ID} />);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect((state['activeLens'] as Record<string, string>)[SESSION_ID]).toBe('agents');
    expect((state['selectedAgentId'] as Record<string, string>)[SESSION_ID]).toBe(AGENT_ID);
  });
});
