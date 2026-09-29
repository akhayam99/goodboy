import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import type { AgentId, IsoDateTime, ProviderRunId, SessionId } from '@goodboy/types';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../shared/lib/db', async () =>
  (await import('../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../../features/chat/turn', async () =>
  (await import('../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../features/permissions/permissions', async () =>
  (await import('../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../features/providers/providers', async () =>
  (await import('../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../features/providers/routing', async () =>
  (await import('../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../features/budget/budget', async () =>
  (await import('../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../features/skills/skills', async () =>
  (await import('../../store/storyHarness')).skillsModuleMock(),
);
vi.mock('../../features/workflows/workflows', async () =>
  (await import('../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../features/worktree/worktree', async () =>
  (await import('../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../shared/lib/repo', async () =>
  (await import('../../store/storyHarness')).repoModuleMock(),
);
vi.mock('../../features/plans/plans', async () =>
  (await import('../../store/storyHarness')).plansModuleMock(),
);

const SESSION_ID = 'sess-1' as SessionId;
const AGENT_ID = 'agent-1' as AgentId;
const RUN_ID = 'run-1' as ProviderRunId;
const AT: IsoDateTime = '2026-05-07T00:00:00.000Z' as IsoDateTime;

describe('store unknownPayloadCounts', () => {
  let useAppStore: StoryStore;

  beforeAll(async () => {
    useAppStore = await importStore();
  }, STORE_IMPORT_TIMEOUT_MS);

  beforeEach(async () => {
    await resetStoryStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts at empty object', () => {
    const counts = useAppStore.getState().unknownPayloadCounts;
    expect(counts).toEqual({});
  });

  it('increments counter keyed by adapter:payloadType on first unknown_payload', () => {
    const { appendTurnEvent } = useAppStore.getState();
    appendTurnEvent(AGENT_ID, SESSION_ID, {
      kind: 'unknown_payload',
      runId: RUN_ID,
      adapter: 'anthropic',
      payloadType: 'ping',
      raw: { type: 'ping' },
      at: AT,
    });
    expect(useAppStore.getState().unknownPayloadCounts['anthropic:ping']).toBe(1);
  });

  it('accumulates multiple events of the same key', () => {
    const { appendTurnEvent } = useAppStore.getState();
    for (let i = 0; i < 3; i++) {
      appendTurnEvent(AGENT_ID, SESSION_ID, {
        kind: 'unknown_payload',
        runId: RUN_ID,
        adapter: 'cursor',
        payloadType: 'debug_trace',
        raw: {},
        at: AT,
      });
    }
    expect(useAppStore.getState().unknownPayloadCounts['cursor:debug_trace']).toBe(3);
  });

  it('tracks different adapter/payloadType keys independently', () => {
    const { appendTurnEvent } = useAppStore.getState();
    appendTurnEvent(AGENT_ID, SESSION_ID, {
      kind: 'unknown_payload',
      runId: RUN_ID,
      adapter: 'anthropic',
      payloadType: 'ping',
      raw: {},
      at: AT,
    });
    appendTurnEvent(AGENT_ID, SESSION_ID, {
      kind: 'unknown_payload',
      runId: RUN_ID,
      adapter: 'codex',
      payloadType: 'ping',
      raw: {},
      at: AT,
    });
    const counts = useAppStore.getState().unknownPayloadCounts;
    expect(counts['anthropic:ping']).toBe(1);
    expect(counts['codex:ping']).toBe(1);
  });

  it('does not increment counter for non-unknown_payload events', () => {
    const { appendTurnEvent } = useAppStore.getState();
    appendTurnEvent(AGENT_ID, SESSION_ID, {
      kind: 'assistant_text',
      runId: RUN_ID,
      delta: 'hello',
      at: AT,
    });
    expect(useAppStore.getState().unknownPayloadCounts).toEqual({});
  });
});
