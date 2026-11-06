// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  brandId,
  type AgentId,
  type IsoDateTime,
  type ProviderRunId,
  type SessionId,
  type TurnEvent,
} from '@goodboy/types';

const { announceDataChanged, insertTurnEventsBatch } = vi.hoisted(() => ({
  announceDataChanged: vi.fn(async (_params: unknown) => undefined),
  insertTurnEventsBatch: vi.fn(async (): Promise<void> => undefined),
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({ insertTurnEventsBatch }),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../shared/lib/dataChanged', () => ({
  announceDataChanged,
  listenDataChanged: async () => () => undefined,
}));

import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const AGENT_ID = brandId<AgentId>({ value: 'agent-ledger' });
const RUN_ID = brandId<ProviderRunId>({ value: 'run-ledger' });
const AT = brandId<IsoDateTime>({ value: '2026-11-06T10:00:00.000Z' });

const decision = ({ decidedBy }: { readonly decidedBy: 'user' | 'engine' }): TurnEvent => ({
  kind: 'permission_decision',
  runId: RUN_ID,
  toolUseId: 'tool-migrate',
  decision: 'allow',
  ruleId: null,
  decidedBy,
  at: AT,
});

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  announceDataChanged.mockClear();
  insertTurnEventsBatch.mockReset();
  insertTurnEventsBatch.mockResolvedValue(undefined);
});

describe('telling the other windows about an answer', () => {
  it('waits until the decision is saved', async () => {
    let save: () => void = () => undefined;
    insertTurnEventsBatch.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          save = resolve;
        }),
    );

    store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, decision({ decidedBy: 'user' }));
    await vi.waitFor(() => expect(insertTurnEventsBatch).toHaveBeenCalledOnce());
    expect(announceDataChanged).not.toHaveBeenCalled();

    save();

    await vi.waitFor(() =>
      expect(announceDataChanged).toHaveBeenCalledWith({
        change: { kind: 'agent-turn', sessionId: SESSION_ID, agentId: AGENT_ID },
      }),
    );
  });

  it('says nothing about a decision of the engine', async () => {
    store.getState().appendTurnEvent(AGENT_ID, SESSION_ID, decision({ decidedBy: 'engine' }));

    await vi.waitFor(() => expect(insertTurnEventsBatch).toHaveBeenCalledOnce());
    expect(announceDataChanged).not.toHaveBeenCalled();
  });
});
