import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, IsoDateTime, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';

const h = vi.hoisted(() => ({ settings: new Map<string, string>() }));

vi.mock('@goodboy/db', () => ({
  getSetting: vi.fn(async (_db: unknown, key: string) => h.settings.get(key) ?? null),
  setSetting: vi.fn(async (_db: unknown, key: string, value: string) => {
    h.settings.set(key, value);
  }),
}));
vi.mock('../../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { RESTART_RESUME_PROMPT } from './planRestartResume';
import { INTERRUPTED_RUNS_KEY, RESTART_REASON_KEY } from './restartMarker';
import { resumeInterruptedAgents } from './resumeInterruptedAgents';

const AT = '2026-09-27T10:00:00.000Z' as IsoDateTime;
const SESSION = 'session-1' as SessionId;

const agentOf = (id: string, runId: string, overrides: Partial<Agent> = {}): Agent =>
  ({
    id,
    sessionId: SESSION,
    ordinal: 0,
    name: id,
    status: 'stopped',
    stoppedBy: 'app',
    runId: runId as ProviderRunId,
    providerSessionId: `thread-${id}`,
    providerSessionProviderId: 'anthropic',
    ...overrides,
  }) as Agent;

type StoreParams = {
  readonly agents: ReadonlyArray<Agent>;
  readonly disconnected?: boolean;
};

const buildStore = ({ agents, disconnected = false }: StoreParams) => {
  const appended: Array<{ agentId: string; event: TurnEvent }> = [];
  const sendTurn = vi.fn(async (_input: unknown) => ({ blockedOverBudget: false }));
  const transcripts: Record<string, ReadonlyArray<TurnEvent>> = Object.fromEntries(
    agents.map((agent) => [
      agent.id,
      [
        {
          kind: 'user_text',
          runId: agent.runId ?? ('run-none' as ProviderRunId),
          text: 'ship it',
          at: AT,
        } satisfies TurnEvent,
      ],
    ]),
  );
  const state = {
    sessions: [
      { id: SESSION, providerPreference: { defaultProvider: 'anthropic' }, workflowRuns: [] },
    ],
    sessionPhaseRuns: { [SESSION]: agents },
    transcripts,
    authResults: { anthropic: { state: disconnected ? 'disconnected' : 'connected' } },
    loadAgentTranscript: vi.fn(async () => undefined),
    appendTurnEvent: (agentId: string, _sessionId: string, event: TurnEvent) => {
      appended.push({ agentId, event });
    },
    sendTurn,
  };
  return { get: (() => state) as never, appended, sendTurn };
};

const writeMarker = (runIds: ReadonlyArray<string>, at = Date.now()) =>
  h.settings.set(INTERRUPTED_RUNS_KEY, JSON.stringify({ runIds, at }));

beforeEach(() => {
  h.settings.clear();
});

describe('resumeInterruptedAgents', () => {
  it('resumes every agent the app stopped mid-turn and takes it off the marker', async () => {
    writeMarker(['run-a', 'run-elsewhere']);
    const store = buildStore({ agents: [agentOf('agent-a', 'run-a')] });

    await resumeInterruptedAgents({ get: store.get });

    expect(store.appended).toEqual([
      {
        agentId: 'agent-a',
        event: expect.objectContaining({
          kind: 'decision_note',
          message: 'Resumed after Goodboy restarted.',
        }),
      },
    ]);
    expect(store.sendTurn).toHaveBeenCalledWith({
      sessionId: SESSION,
      agentId: 'agent-a',
      content: RESTART_RESUME_PROMPT,
    });
    expect(JSON.parse(h.settings.get(INTERRUPTED_RUNS_KEY) ?? '{}').runIds).toEqual([
      'run-elsewhere',
    ]);
  });

  it('leaves an agent that was not cut by a clean exit as Stopped by restart', async () => {
    writeMarker(['run-other']);
    const store = buildStore({ agents: [agentOf('agent-a', 'run-a')] });

    await resumeInterruptedAgents({ get: store.get });

    expect(store.sendTurn).not.toHaveBeenCalled();
    expect(store.appended).toEqual([]);
  });

  it('never resumes an agent the user stopped', async () => {
    writeMarker(['run-a']);
    const store = buildStore({ agents: [agentOf('agent-a', 'run-a', { stoppedBy: 'you' })] });

    await resumeInterruptedAgents({ get: store.get });

    expect(store.sendTurn).not.toHaveBeenCalled();
  });

  it('names the update when the updater restarted the app', async () => {
    const at = Date.now();
    writeMarker(['run-a'], at);
    h.settings.set(RESTART_REASON_KEY, JSON.stringify({ reason: 'update', at: at - 1000 }));
    const store = buildStore({ agents: [agentOf('agent-a', 'run-a')] });

    await resumeInterruptedAgents({ get: store.get });

    expect(store.appended[0]?.event).toMatchObject({ message: 'Resumed after Goodboy updated.' });
  });

  it('keeps the agent stopped when its provider is not connected', async () => {
    writeMarker(['run-a']);
    const store = buildStore({ agents: [agentOf('agent-a', 'run-a')], disconnected: true });

    await resumeInterruptedAgents({ get: store.get });

    expect(store.sendTurn).not.toHaveBeenCalled();
  });
});
