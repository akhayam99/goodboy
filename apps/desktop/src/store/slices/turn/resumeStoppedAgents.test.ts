import { describe, expect, it, vi } from 'vitest';
import type { Agent, AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { resumeStoppedAgents } from './resumeStoppedAgents';
import type { GetFn } from './types';

const SESSION_ID = 'sess-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

const agentOf = (overrides: Partial<Agent>): Agent =>
  ({
    id: 'agent' as AgentId,
    status: 'stopped',
    stoppedBy: 'app',
    ...overrides,
  }) as Agent;

const buildGet = (agents: ReadonlyArray<Agent>, continueStoppedAgent = vi.fn(async () => {})) =>
  ({
    get: (() => ({
      sessionPhaseRuns: { [SESSION_ID]: agents },
      continueStoppedAgent,
    })) as unknown as GetFn,
    continueStoppedAgent,
  }) as const;

describe('resumeStoppedAgents', () => {
  it('resumes only the agents the restart stopped and never a user stop or a done agent', async () => {
    const { get, continueStoppedAgent } = buildGet([
      agentOf({ id: 'a' as AgentId }),
      agentOf({ id: 'b' as AgentId, workflowRunId: RUN_ID }),
      agentOf({ id: 'c' as AgentId, stoppedBy: 'you' }),
      agentOf({ id: 'd' as AgentId, doneAt: '2026-09-29T10:00:00.000Z' as Agent['doneAt'] }),
      agentOf({ id: 'e' as AgentId, status: 'running' }),
    ]);

    const count = await resumeStoppedAgents(get)({ sessionId: SESSION_ID });

    expect(count).toBe(2);
    expect(continueStoppedAgent.mock.calls).toEqual([
      [{ sessionId: SESSION_ID, agentId: 'a' }],
      [{ sessionId: SESSION_ID, agentId: 'b' }],
    ]);
  });

  it('keeps to one workflow run when asked', async () => {
    const { get, continueStoppedAgent } = buildGet([
      agentOf({ id: 'a' as AgentId }),
      agentOf({ id: 'b' as AgentId, workflowRunId: RUN_ID }),
    ]);

    await resumeStoppedAgents(get)({ sessionId: SESSION_ID, workflowRunId: RUN_ID });

    expect(continueStoppedAgent).toHaveBeenCalledOnce();
    expect(continueStoppedAgent).toHaveBeenCalledWith({ sessionId: SESSION_ID, agentId: 'b' });
  });

  it('still resumes the others when one fails, then reports the failure', async () => {
    const continueStoppedAgent = vi.fn(async ({ agentId }: { readonly agentId: AgentId }) => {
      if (agentId === 'a') {
        throw new Error('provider gone');
      }
    });
    const { get } = buildGet(
      [agentOf({ id: 'a' as AgentId }), agentOf({ id: 'b' as AgentId })],
      continueStoppedAgent as never,
    );

    await expect(resumeStoppedAgents(get)({ sessionId: SESSION_ID })).rejects.toThrow(
      'provider gone',
    );
    expect(continueStoppedAgent).toHaveBeenCalledTimes(2);
  });
});
