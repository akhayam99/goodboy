// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { sampleScoutRuns } from './sampleScoutRuns';
import { startSampleScout } from './startSampleScout';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
});

afterEach(() => {
  sampleScoutRuns.cancel();
  vi.useRealTimers();
});

const WORKSPACE = brandId<WorkspaceId>({ value: 'mock-workspace-harborline' });

const start = async () => {
  const session = await startSampleScout({
    workspaceId: WORKSPACE,
    start: {
      kind: 'scout',
      agentKind: 'scout',
      focus: 'Find one small bug in payments-api.',
      prompt: 'Find one small bug in payments-api.',
      routing: null,
    },
  });
  store.setState({ currentSessionId: session.id });
  const agentId = store.getState().selectedAgentId[session.id];
  if (agentId === null || agentId === undefined) {
    throw new Error('no scout');
  }
  return { sessionId: session.id, agentId };
};

type AgentParams = {
  readonly agentId: string;
};

const kindsOf = ({ agentId }: AgentParams) =>
  (store.getState().transcripts[agentId] ?? []).map((event) => event.kind);

describe('the sample scout', () => {
  it('answers the first task', async () => {
    const { agentId } = await start();
    vi.advanceTimersByTime(30000);
    expect(kindsOf({ agentId }).at(-1)).toBe('done');
  });

  it('writes nothing more once the visitor stops it', async () => {
    const { sessionId, agentId } = await start();
    vi.advanceTimersByTime(1500);
    await store.getState().cancelCurrentTurn(sessionId, agentId, 'user');
    const before = kindsOf({ agentId });
    vi.advanceTimersByTime(30000);
    expect(kindsOf({ agentId })).toEqual(before);
    expect(before).not.toContain('done');
    expect(store.getState().agentTurnState[agentId]?.kind).toBe('idle');
    expect(
      store.getState().sessionPhaseRuns[sessionId]?.find((agent) => agent.id === agentId)?.status,
    ).toBe('stopped');
  });

  it('drops the pending reply when the scene tears down', async () => {
    const { agentId } = await start();
    const before = kindsOf({ agentId });
    sampleScoutRuns.cancel();
    vi.advanceTimersByTime(30000);
    expect(kindsOf({ agentId })).toEqual(before);
  });
});
