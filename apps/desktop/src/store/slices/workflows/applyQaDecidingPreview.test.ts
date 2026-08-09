import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invokeSpy } = vi.hoisted(() => ({ invokeSpy: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeSpy }));

import { applyQaDecidingPreview } from './applyQaDecidingPreview';

type State = Record<string, unknown>;

const harness = (state: State) => {
  const set = vi.fn((updater: unknown) => {
    if (typeof updater === 'function') {
      Object.assign(state, (updater as (current: State) => State)(state));
      return;
    }
    Object.assign(state, updater as State);
  });
  return { set: set as never, state };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('applyQaDecidingPreview', () => {
  it('marks the named runs as deciding without touching the rest', async () => {
    const state: State = { orchestratingWorkflowRuns: { 'run-9': true } };
    const { set } = harness(state);
    invokeSpy.mockResolvedValueOnce(['run-1', 'run-2']);

    await applyQaDecidingPreview({ set });

    expect(invokeSpy).toHaveBeenCalledWith('qa_deciding_workflow_runs');
    expect(state['orchestratingWorkflowRuns']).toEqual({
      'run-9': true,
      'run-1': true,
      'run-2': true,
    });
  });

  it('leaves the store alone when the environment names no run', async () => {
    const state: State = { orchestratingWorkflowRuns: {} };
    const { set } = harness(state);
    invokeSpy.mockResolvedValueOnce([]);

    await applyQaDecidingPreview({ set });

    expect(set).not.toHaveBeenCalled();
    expect(state['orchestratingWorkflowRuns']).toEqual({});
  });
});
