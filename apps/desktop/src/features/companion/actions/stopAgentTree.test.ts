// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { AGENT, LEAD, RUN, SESSION, WORKSPACE, buildTestStore } from './testing/decideTestKit';
import { stopAgentTree } from './stopAgentTree';

const RUNNING = {
  autoTreeViews: {},
  agentTurnState: {
    [AGENT]: { kind: 'running', runId: 'provider-run-1' },
    [LEAD]: { kind: 'running', runId: 'provider-run-2' },
  },
  sessionPhaseRuns: {
    [SESSION]: [
      { id: LEAD, name: 'Lead', status: 'running', workflowRunId: RUN },
      { id: AGENT, name: 'Builder', status: 'running', workflowRunId: RUN },
    ],
  },
};

const actionOf = (seenState: 'running' | 'waiting') => ({
  kind: 'stopAgentTree' as const,
  actionId: 'act:stopAgentTree:agent-lead:running',
  workspaceId: WORKSPACE,
  sessionId: SESSION,
  agentId: LEAD,
  seenState,
});

describe('stopAgentTree', () => {
  it('stops the Lead and every running agent of its run in one action', async () => {
    const kit = buildTestStore({ state: RUNNING });

    const result = await stopAgentTree({
      action: actionOf('running'),
      getStore: () => kit.store,
      ports: kit.ports,
    });

    expect(result.kind).toBe('done');
    expect(kit.actions.cancelTurnConfirmed).toHaveBeenCalledTimes(2);
  });

  it('stops nothing when the Lead changed since the phone looked', async () => {
    const kit = buildTestStore({ state: RUNNING });

    const result = await stopAgentTree({
      action: actionOf('waiting'),
      getStore: () => kit.store,
      ports: kit.ports,
    });

    expect(result.kind).toBe('refused');
    expect(kit.actions.cancelTurnConfirmed).not.toHaveBeenCalled();
  });

  it('reports how many stopped when one agent keeps running', async () => {
    const kit = buildTestStore({ state: RUNNING });
    kit.actions.cancelTurnConfirmed
      .mockResolvedValueOnce({ outcome: 'exited', exitedAt: 'x' })
      .mockResolvedValueOnce({ outcome: 'still_running' });

    const result = await stopAgentTree({
      action: actionOf('running'),
      getStore: () => kit.store,
      ports: kit.ports,
    });

    expect(result).toEqual({ kind: 'failed', error: 'Stopped 1 of 2. Try again.' });
  });

  it('finishes the tree on a retry after the Lead already stopped', async () => {
    const kit = buildTestStore({
      state: {
        ...RUNNING,
        agentTurnState: { [AGENT]: { kind: 'running', runId: 'provider-run-1' } },
        sessionPhaseRuns: {
          [SESSION]: [
            { id: LEAD, name: 'Lead', status: 'stopped', workflowRunId: RUN },
            { id: AGENT, name: 'Builder', status: 'running', workflowRunId: RUN },
          ],
        },
      },
    });

    const result = await stopAgentTree({
      action: actionOf('running'),
      getStore: () => kit.store,
      ports: kit.ports,
    });

    expect(result.kind).toBe('done');
    expect(kit.actions.cancelTurnConfirmed).toHaveBeenCalledTimes(1);
  });
});
