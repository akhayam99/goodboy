// @vitest-environment happy-dom

vi.mock('../../../shared/lib/db', () => ({
  tauriDatabase: {
    execute: vi.fn(async () => ({ rowsAffected: 1 })),
    select: vi.fn(async () => []),
  },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession, aWorkflowRun, anAgent } from '@goodboy/types/testing';
import { brandId, type AgentId, type SessionId, type StepId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { emitTurnNudges } from './turnHelpers';

const SESSION = brandId<SessionId>({ value: 'session-harborline' });
const AGENT = brandId<AgentId>({ value: 'agent-source' });

beforeEach(() => {
  useAppStore.setState({
    sessions: [aSession({ id: SESSION })],
    sessionPhaseRuns: { [SESSION]: [] },
    sessionNudges: {},
  });
});

const emit = (assistantText: string) =>
  emitTurnNudges(useAppStore.setState, useAppStore.getState, SESSION, AGENT, assistantText, null);

describe('handoff nudges after a turn', () => {
  it('suggests the next role when an agent asks for one', async () => {
    await emit('Done. <<handoff kind=implementer reason="the plan is ready">>');

    expect(useAppStore.getState().sessionNudges[SESSION]).toMatchObject({
      kind: 'handoff-suggested',
      targetKind: 'implementer',
    });
  });

  it('leaves a handoff to Auto to the chip, which moves the agent instead of starting a new one', async () => {
    await emit('Done. <<handoff kind=auto reason="this needs several agents">>');

    expect(useAppStore.getState().sessionNudges[SESSION] ?? null).toBeNull();
  });

  it('keeps a workflow step agent from raising a handoff nudge, the run decides the next step', async () => {
    const run = aWorkflowRun();
    useAppStore.setState({
      sessions: [aSession({ id: SESSION, workflowRuns: [run] })],
      sessionPhaseRuns: {
        [SESSION]: [
          anAgent({
            id: AGENT,
            sessionId: SESSION,
            workflowRunId: run.id,
            stepId: brandId<StepId>({ value: 'step-scout' }),
            status: 'completed',
          }),
        ],
      },
    });

    await emit('Done. <<handoff kind=planner reason="plan the fix">>');

    expect(useAppStore.getState().sessionNudges[SESSION] ?? null).toBeNull();
  });
});
