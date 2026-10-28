// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent, IsoDateTime, TurnState } from '@goodboy/types';
import { aSession, anAgent, nextProviderRunId } from '@goodboy/types/testing';
import type { SendTurnResult } from '../turn/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../features/chat/turn', async () =>
  (await import('../../storyHarness')).turnModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock({}));

const session = aSession();
const blockedAgent: Agent = anAgent({ sessionId: session.id, status: 'blocked' });

let useAppStore: StoryStore;
const sendTurn = vi.fn(async (): Promise<SendTurnResult> => ({ blockedOverBudget: false }));

const STARTED_AT: IsoDateTime = JSON.parse('"2026-10-16T15:00:00.000Z"');

const LIVE_TURNS: Readonly<Record<'running' | 'starting', TurnState>> = {
  running: { kind: 'running', runId: nextProviderRunId(), startedAt: STARTED_AT },
  starting: { kind: 'starting', startedAt: STARTED_AT },
};

type SeedParams = {
  readonly agent: Agent;
  readonly turnKind?: 'running' | 'starting';
};

const seed = ({ agent, turnKind }: SeedParams): void => {
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: { [session.id]: [agent] },
    agentTurnState: turnKind === undefined ? {} : { [agent.id]: LIVE_TURNS[turnKind] },
    sendTurn,
  });
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seed({ agent: blockedAgent });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('answerBlockedStep', () => {
  it('sends the answer to the blocked step agent as a workflow turn', async () => {
    await useAppStore.getState().answerBlockedStep({
      sessionId: session.id,
      agentId: blockedAgent.id,
      text: '  Push to feat-patient-settings.  ',
    });

    expect(sendTurn).toHaveBeenCalledTimes(1);
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: session.id,
        agentId: blockedAgent.id,
        origin: 'workflow',
        content: expect.stringContaining('Push to feat-patient-settings.'),
      }),
    );
    expect(sendTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining(`<<step-done id="${blockedAgent.id}">>`),
      }),
    );
  });

  it('sends nothing for an empty answer', async () => {
    await useAppStore
      .getState()
      .answerBlockedStep({ sessionId: session.id, agentId: blockedAgent.id, text: '   ' });

    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('refuses when the step is not blocked any more, so the text stays with the caller', async () => {
    seed({ agent: { ...blockedAgent, status: 'running' } });

    await expect(
      useAppStore
        .getState()
        .answerBlockedStep({ sessionId: session.id, agentId: blockedAgent.id, text: 'Go on' }),
    ).rejects.toThrow('no longer waiting for an answer');
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('refuses while a turn of the step is already live', async () => {
    seed({ agent: blockedAgent, turnKind: 'running' });

    await expect(
      useAppStore
        .getState()
        .answerBlockedStep({ sessionId: session.id, agentId: blockedAgent.id, text: 'Go on' }),
    ).rejects.toThrow('no longer waiting for an answer');
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('refuses the answer when the session budget stopped the turn, so the text stays with the caller', async () => {
    sendTurn.mockResolvedValueOnce({ blockedOverBudget: true });

    await expect(
      useAppStore
        .getState()
        .answerBlockedStep({ sessionId: session.id, agentId: blockedAgent.id, text: 'Go on' }),
    ).rejects.toThrow('session budget is reached');
  });

  it('refuses the answer when another agent holds the folder, so the text stays with the caller', async () => {
    sendTurn.mockResolvedValueOnce({ blockedOverBudget: false, isWriterLeaseDenied: true });

    await expect(
      useAppStore
        .getState()
        .answerBlockedStep({ sessionId: session.id, agentId: blockedAgent.id, text: 'Go on' }),
    ).rejects.toThrow('Another agent is writing');
  });

  it('passes a failed send to the caller to report and retry', async () => {
    sendTurn.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(
      useAppStore
        .getState()
        .answerBlockedStep({ sessionId: session.id, agentId: blockedAgent.id, text: 'Go on' }),
    ).rejects.toThrow('provider unavailable');
  });
});
