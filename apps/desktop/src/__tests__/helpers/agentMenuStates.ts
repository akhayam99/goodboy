import { brandId, type Agent, type ProviderRunId, type TurnState } from '@goodboy/types';
import {
  AGENT,
  FIXTURE_NOW,
  RUN,
  agentFixture,
  mountFixture,
  questionFixture,
  type ActionSeed,
} from './actionFixtures';

export const RUNNING: TurnState = {
  kind: 'running',
  runId: brandId<ProviderRunId>({ value: 'provider-run' }),
  startedAt: FIXTURE_NOW,
};
export const STARTING: TurnState = { kind: 'starting', startedAt: FIXTURE_NOW };

export const standalone = (
  value: Partial<ActionSeed> & { readonly status: Agent['status'] },
): ActionSeed => ({
  agents: [agentFixture({ status: value.status, ...(value.agents?.[0] ?? {}) })],
  mounts: [mountFixture()],
  ...value,
});

export const AGENT_STATES: ReadonlyArray<readonly [string, ActionSeed, ReadonlyArray<string>]> = [
  [
    'starting',
    standalone({ status: 'pending', turnStates: { [AGENT]: STARTING } }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.rename',
      'agent.moveToAuto (Wait for the turn to end first.)',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'running',
    standalone({ status: 'running', turnStates: { [AGENT]: RUNNING } }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.rename',
      'agent.stop',
      'agent.moveToAuto (Wait for the turn to end first.)',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'waiting on you',
    standalone({
      status: 'completed',
      questions: [questionFixture({ createdByAgentId: AGENT })],
    }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.rename',
      'agent.close',
      'agent.moveToAuto',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'stopped',
    standalone({ status: 'stopped' }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.rename',
      'agent.moveToAuto',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'failed',
    standalone({ status: 'failed' }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.rename',
      'agent.close',
      'agent.moveToAuto',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'done',
    standalone({ status: 'completed' }),
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.rename',
      'agent.moveToAuto',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'closed by you',
    { agents: [agentFixture({ status: 'failed', doneAt: FIXTURE_NOW })], mounts: [mountFixture()] },
    [
      'agent.open',
      'agent.changes',
      'agent.rename',
      'agent.reopen',
      'agent.moveToAuto',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'a running workflow step',
    {
      agents: [agentFixture({ status: 'running', workflowRunId: RUN })],
      turnStates: { [AGENT]: RUNNING },
      mounts: [mountFixture()],
    },
    [
      'agent.open',
      'agent.changes',
      'agent.message',
      'agent.stop',
      'agent.copyName',
      'agent.delete',
    ],
  ],
  [
    'in a session with no project',
    { agents: [agentFixture({ status: 'completed' })] },
    [
      'agent.open',
      'agent.changes (This session has no folder yet)',
      'agent.message',
      'agent.rename',
      'agent.moveToAuto',
      'agent.model',
      'agent.copyName',
      'agent.delete',
    ],
  ],
];
