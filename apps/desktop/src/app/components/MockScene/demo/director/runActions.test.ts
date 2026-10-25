// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  C08_IMPLEMENTER_ID,
  C08_REVIEWER_ID,
  C08_SESSION_ID,
  seedC08,
} from '../../scenes/u25/c08RunSeed';
import { installRunActions } from './runActions';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  vi.useRealTimers();
});

type StatusParams = {
  readonly agentId: string;
};

const statusOf = ({ agentId }: StatusParams) =>
  (store.getState().sessionPhaseRuns[C08_SESSION_ID] ?? []).find((agent) => agent.id === agentId)
    ?.status;

describe('the simulated run step', () => {
  it('runs the started step and completes it only after its cues', async () => {
    seedC08({ state: 'ready', selection: 'implementer' });
    installRunActions({ store });
    await store
      .getState()
      .activateWorkflowAgent({ sessionId: C08_SESSION_ID, agentId: C08_REVIEWER_ID });
    expect(statusOf({ agentId: C08_REVIEWER_ID })).toBe('running');
    expect(store.getState().agentTurnState[C08_REVIEWER_ID]?.kind).toBe('running');
    vi.advanceTimersByTime(3000);
    expect(statusOf({ agentId: C08_REVIEWER_ID })).toBe('running');
    vi.advanceTimersByTime(5000);
    expect(statusOf({ agentId: C08_REVIEWER_ID })).toBe('completed');
    expect(store.getState().transcripts[C08_REVIEWER_ID]?.at(-1)?.kind).toBe('done');
    expect(store.getState().selectedAgentId[C08_SESSION_ID]).toBe(C08_REVIEWER_ID);
  });

  it('ignores a second start while the step is still running', async () => {
    seedC08({ state: 'approval', selection: 'scout' });
    installRunActions({ store });
    const start = () =>
      store
        .getState()
        .activateWorkflowAgent({ sessionId: C08_SESSION_ID, agentId: C08_IMPLEMENTER_ID });
    await start();
    await start();
    const asks = (store.getState().transcripts[C08_IMPLEMENTER_ID] ?? []).filter(
      (event) => event.kind === 'user_text',
    );
    expect(asks).toHaveLength(1);
    vi.advanceTimersByTime(8000);
    expect(statusOf({ agentId: C08_IMPLEMENTER_ID })).toBe('completed');
  });

  it('connects the sample providers so the model picker has choices', () => {
    seedC08({ state: 'ready', selection: 'implementer' });
    store.setState({ providers: [] });
    installRunActions({ store });
    expect(store.getState().providers.map((provider) => provider.id)).toEqual([
      'anthropic',
      'codex',
    ]);
  });
});
