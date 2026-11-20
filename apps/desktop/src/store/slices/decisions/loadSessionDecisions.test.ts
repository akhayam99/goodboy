// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

type Ledger = {
  readonly label: string;
};

type Pending = {
  readonly resolve: (ledger: Ledger) => void;
  readonly reject: (error: Error) => void;
};

const { reads } = vi.hoisted(() => {
  const pending: Array<Pending> = [];
  return { reads: pending };
});

vi.mock('@goodboy/core/context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/core/context')>()),
  loadDecisionLedger: () =>
    new Promise<Ledger>((resolve, reject) => {
      reads.push({ resolve, reject });
    }),
  seedDecisionLedger: () => ({ label: 'seeded' }),
  applyDecisionOpsToSession: async () => ({ ledger: { label: 'edited' }, changes: [] }),
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type SessionId } from '@goodboy/types';
import type { DecisionActor } from '@goodboy/core/context';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../storyHarness';

const SESSION_ID = brandId<SessionId>({ value: 'session-ledger' });
const USER: DecisionActor = { author: 'user', agentId: null, turnOrdinal: null };

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  reads.length = 0;
  await resetStoryStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

type ReadParams = {
  readonly index: number;
};

const readAt = ({ index }: ReadParams): Pending => {
  const pending = reads[index];
  if (pending === undefined) {
    throw new Error(`no ledger read ${index}`);
  }
  return pending;
};

const ledgerShown = (): unknown => useAppStore.getState().sessionDecisions[SESSION_ID];

describe('loadSessionDecisions', () => {
  it('drops a load that answers after a newer load', async () => {
    const { loadSessionDecisions } = useAppStore.getState();

    const older = loadSessionDecisions(SESSION_ID);
    const newer = loadSessionDecisions(SESSION_ID);
    readAt({ index: 1 }).resolve({ label: 'newer' });
    await newer;
    readAt({ index: 0 }).resolve({ label: 'older' });
    await older;

    expect(ledgerShown()).toEqual({ label: 'newer' });
  });

  it('keeps an applied edit over a load that started before it', async () => {
    const { loadSessionDecisions, applySessionDecisionOps } = useAppStore.getState();

    const stale = loadSessionDecisions(SESSION_ID);
    await applySessionDecisionOps({ sessionId: SESSION_ID, ops: [], actor: USER });
    readAt({ index: 0 }).resolve({ label: 'before the edit' });
    await stale;

    expect(ledgerShown()).toEqual({ label: 'edited' });
  });

  it('seeds nothing for a failed load that a newer one replaced', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { loadSessionDecisions } = useAppStore.getState();

    const older = loadSessionDecisions(SESSION_ID);
    const newer = loadSessionDecisions(SESSION_ID);
    readAt({ index: 0 }).reject(new Error('database is locked'));
    await older;

    expect(ledgerShown()).toBeUndefined();
    readAt({ index: 1 }).resolve({ label: 'newer' });
    await newer;
    expect(ledgerShown()).toEqual({ label: 'newer' });
  });
});
