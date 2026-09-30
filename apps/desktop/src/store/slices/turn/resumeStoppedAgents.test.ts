import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { Agent, AgentId, SessionId, WorkflowRunId } from '@goodboy/types';
import { anAgent, TEST_NOW } from '@goodboy/types/testing';
import { useAppStore, type AppStore } from '../../store';
import { resumeStoppedAgents } from './resumeStoppedAgents';

const SESSION_ID = 'sess-1' as SessionId;
const RUN_ID = 'run-1' as WorkflowRunId;

type BuildGetParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly continueStoppedAgent?: Mock<AppStore['continueStoppedAgent']>;
};

const buildGet = ({
  agents,
  continueStoppedAgent = vi.fn<AppStore['continueStoppedAgent']>(async () => undefined),
}: BuildGetParams) => {
  const store = {
    sessionPhaseRuns: { [SESSION_ID]: agents },
    continueStoppedAgent,
  } satisfies Pick<AppStore, 'sessionPhaseRuns' | 'continueStoppedAgent'>;
  const get = () => ({ ...useAppStore.getState(), ...store });
  return {
    get,
    continueStoppedAgent,
  } as const;
};

describe('resumeStoppedAgents', () => {
  it('resumes only the agents the restart stopped and never a user stop or a done agent', async () => {
    const { get, continueStoppedAgent } = buildGet({
      agents: [
        anAgent({ id: 'a' as AgentId, status: 'stopped', stoppedBy: 'app' }),
        anAgent({
          id: 'b' as AgentId,
          status: 'stopped',
          stoppedBy: 'app',
          workflowRunId: RUN_ID,
        }),
        anAgent({ id: 'c' as AgentId, status: 'stopped', stoppedBy: 'you' }),
        anAgent({
          id: 'd' as AgentId,
          status: 'stopped',
          stoppedBy: 'app',
          doneAt: TEST_NOW,
        }),
        anAgent({ id: 'e' as AgentId, status: 'running', stoppedBy: 'app' }),
      ],
    });

    const count = await resumeStoppedAgents(get)({ sessionId: SESSION_ID });

    expect(count).toBe(2);
    expect(continueStoppedAgent.mock.calls).toEqual([
      [{ sessionId: SESSION_ID, agentId: 'a' }],
      [{ sessionId: SESSION_ID, agentId: 'b' }],
    ]);
  });

  it('keeps to one workflow run when asked', async () => {
    const { get, continueStoppedAgent } = buildGet({
      agents: [
        anAgent({ id: 'a' as AgentId, status: 'stopped', stoppedBy: 'app' }),
        anAgent({
          id: 'b' as AgentId,
          status: 'stopped',
          stoppedBy: 'app',
          workflowRunId: RUN_ID,
        }),
      ],
    });

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
    const { get } = buildGet({
      agents: [
        anAgent({ id: 'a' as AgentId, status: 'stopped', stoppedBy: 'app' }),
        anAgent({ id: 'b' as AgentId, status: 'stopped', stoppedBy: 'app' }),
      ],
      continueStoppedAgent,
    });

    await expect(resumeStoppedAgents(get)({ sessionId: SESSION_ID })).rejects.toThrow(
      'provider gone',
    );
    expect(continueStoppedAgent).toHaveBeenCalledTimes(2);
  });
});
