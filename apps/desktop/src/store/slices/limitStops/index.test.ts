vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type AgentId, type ProviderRunId, type SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';
import type { LimitStop } from './state';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const NOW_MS = Date.UTC(2026, 9, 23, 12, 0, 0);
const RESET_MS = NOW_MS + 6 * 60 * 60 * 1000;
const SESSION_ID = brandId<SessionId>({ value: 'session-harborline-limit' });
const AGENT_A = brandId<AgentId>({ value: 'agent-harborline-a' });
const AGENT_B = brandId<AgentId>({ value: 'agent-harborline-b' });

type StopParams = {
  readonly runId: ProviderRunId;
  readonly agentId?: AgentId;
};

const RUN_1 = brandId<ProviderRunId>({ value: 'run-1' });
const RUN_2 = brandId<ProviderRunId>({ value: 'run-2' });
const RUN_B = brandId<ProviderRunId>({ value: 'run-b' });
const RUN_MISSING = brandId<ProviderRunId>({ value: 'run-missing' });

const stopOf = ({ runId, agentId = AGENT_A }: StopParams): LimitStop => ({
  runId,
  agentId,
  sessionId: SESSION_ID,
  provider: 'anthropic',
  resetAtMs: RESET_MS,
  isScheduled: false,
  input: {
    sessionId: SESSION_ID,
    agentId,
    content: 'finish the export',
    retry: { attempt: 0, provider: 'anthropic', model: 'sonnet-5.5', attachmentRefs: [] },
  },
});

const sendTurn = vi.fn(async () => ({ blockedOverBudget: false }));
const reportError = vi.fn(async () => undefined);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ now: NOW_MS });
  sendTurn.mockClear();
  reportError.mockClear();
  useAppStore.setState({ sendTurn, reportError, limitStops: {} });
});

afterEach(() => {
  useAppStore.getState().clearAgentLimitStops({ agentId: AGENT_A });
  useAppStore.getState().clearAgentLimitStops({ agentId: AGENT_B });
  vi.useRealTimers();
});

describe('limit stops', () => {
  it('records a stop and starts nothing, however long it waits', async () => {
    useAppStore.getState().recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

    expect(Object.keys(useAppStore.getState().limitStops)).toEqual(['run-1']);
    expect(sendTurn).not.toHaveBeenCalled();
  });

  it('keeps only the latest stop of an agent and leaves the others alone', () => {
    const { recordLimitStop } = useAppStore.getState();
    recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });
    recordLimitStop({ stop: stopOf({ runId: RUN_B, agentId: AGENT_B }) });
    recordLimitStop({ stop: stopOf({ runId: RUN_2 }) });

    expect(Object.keys(useAppStore.getState().limitStops).sort()).toEqual(['run-2', 'run-b']);
  });

  it('continues at the reset time after a click, once, with the stored request', async () => {
    useAppStore.getState().recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });

    useAppStore.getState().continueAfterLimit({ runId: RUN_1 });
    useAppStore.getState().continueAfterLimit({ runId: RUN_1 });

    expect(useAppStore.getState().limitStops[RUN_1]?.isScheduled).toBe(true);
    await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS - 1);
    expect(sendTurn).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(sendTurn).toHaveBeenCalledOnce();
    expect(sendTurn).toHaveBeenCalledWith(stopOf({ runId: RUN_1 }).input);
    expect(useAppStore.getState().limitStops).toEqual({});
  });

  it('does not start when the person cancels before the reset', async () => {
    useAppStore.getState().recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });
    useAppStore.getState().continueAfterLimit({ runId: RUN_1 });

    useAppStore.getState().cancelLimitContinue({ runId: RUN_1 });
    await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 60_000);

    expect(sendTurn).not.toHaveBeenCalled();
    expect(useAppStore.getState().limitStops[RUN_1]?.isScheduled).toBe(false);
  });

  it('offers the button again after a cancel, and continues on the second click', async () => {
    useAppStore.getState().recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });
    const runId = RUN_1;
    useAppStore.getState().continueAfterLimit({ runId });
    useAppStore.getState().cancelLimitContinue({ runId });

    useAppStore.getState().continueAfterLimit({ runId });
    await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 1_000);

    expect(sendTurn).toHaveBeenCalledOnce();
  });

  it('drops a scheduled continue when a newer stop replaces it', async () => {
    const { recordLimitStop, continueAfterLimit } = useAppStore.getState();
    recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });
    continueAfterLimit({ runId: RUN_1 });

    recordLimitStop({ stop: stopOf({ runId: RUN_2 }) });
    await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 1_000);

    expect(sendTurn).not.toHaveBeenCalled();
    expect(Object.keys(useAppStore.getState().limitStops)).toEqual(['run-2']);
  });

  it('clears the stops of an agent and stops its timer', async () => {
    const { recordLimitStop, continueAfterLimit, clearAgentLimitStops } = useAppStore.getState();
    recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });
    recordLimitStop({ stop: stopOf({ runId: RUN_B, agentId: AGENT_B }) });
    continueAfterLimit({ runId: RUN_1 });

    clearAgentLimitStops({ agentId: AGENT_A });
    await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 1_000);

    expect(sendTurn).not.toHaveBeenCalled();
    expect(Object.keys(useAppStore.getState().limitStops)).toEqual(['run-b']);
  });

  it('ignores a continue or a cancel for a stop that is gone', async () => {
    useAppStore.getState().continueAfterLimit({ runId: RUN_MISSING });
    useAppStore.getState().cancelLimitContinue({ runId: RUN_MISSING });
    await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 1_000);

    expect(sendTurn).not.toHaveBeenCalled();
    expect(useAppStore.getState().limitStops).toEqual({});
  });

  it('tells the person when the continued turn cannot start', async () => {
    sendTurn.mockRejectedValueOnce(new Error('disk full'));
    useAppStore.getState().recordLimitStop({ stop: stopOf({ runId: RUN_1 }) });
    useAppStore.getState().continueAfterLimit({ runId: RUN_1 });

    await vi.advanceTimersByTimeAsync(RESET_MS - NOW_MS + 1_000);

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Couldn't continue after the usage limit",
        sessionId: SESSION_ID,
      }),
    );
  });
});
