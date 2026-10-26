import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TurnEvent } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStorySession,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from './storyHarness';
import { flushTurnEvents } from './slices/transcripts/buffer';
import { seedStoredTurns, type SeededTurns } from '../test/seedStoredTurns';

vi.mock('@tauri-apps/api/core', async () => (await import('./storyHarness')).tauriCoreModuleMock());
vi.mock('@tauri-apps/api/event', async () =>
  (await import('./storyHarness')).tauriEventModuleMock(),
);
vi.mock('../shared/lib/db', async () => (await import('./storyHarness')).sqliteDbLibModuleMock());
vi.mock('../features/chat/turn', async () => (await import('./storyHarness')).turnModuleMock());
vi.mock('../features/permissions/permissions', async () =>
  (await import('./storyHarness')).permissionsModuleMock(),
);
vi.mock('../features/providers/providers', async () =>
  (await import('./storyHarness')).providersModuleMock(),
);
vi.mock('../features/providers/routing', async () =>
  (await import('./storyHarness')).routingModuleMock(),
);
vi.mock('../features/budget/budget', async () =>
  (await import('./storyHarness')).budgetModuleMock(),
);
vi.mock('../features/skills/skills', async () =>
  (await import('./storyHarness')).skillsModuleMock(),
);
vi.mock('../features/workflows/workflows', async () =>
  (await import('./storyHarness')).workflowsModuleMock(),
);
vi.mock('../features/worktree/worktree', async () =>
  (await import('./storyHarness')).worktreeModuleMock(),
);
vi.mock('../shared/lib/repo', async () => (await import('./storyHarness')).repoModuleMock());
vi.mock('../features/plans/plans', async () => (await import('./storyHarness')).plansModuleMock());

const STORED_ROWS = 120;

type LiveParams = {
  readonly label: string;
};

type OnReadParams = {
  readonly nth: number;
  readonly run: () => void;
};

let useAppStore: StoryStore;
let seeded: SeededTurns;

const liveEvent = ({ label }: LiveParams): TurnEvent => ({
  kind: 'assistant_text',
  runId: seeded.runId,
  delta: label,
  at: STORY_NOW,
});

const append = ({ label }: LiveParams): void => {
  useAppStore.getState().appendTurnEvent(seeded.agentId, seeded.sessionId, liveEvent({ label }));
  flushTurnEvents();
};

const afterTurnEventRead = ({ nth, run }: OnReadParams): void => {
  const db = storySqlite();
  const select = db.select.bind(db);
  let reads = 0;
  vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
    const rows = await select(sql, params);
    if (sql.includes('FROM turn_events')) {
      reads += 1;
      if (reads === nth) {
        run();
      }
    }
    return rows;
  });
};

const deltasOf = (): ReadonlyArray<string> =>
  (useAppStore.getState().transcripts[seeded.agentId] ?? []).flatMap((event) =>
    event.kind === 'assistant_text' ? [event.delta] : [],
  );

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  seeded = await seedStoredTurns({ rowCount: STORED_ROWS });
  useAppStore.setState({
    sessions: [
      buildStorySession({
        id: seeded.sessionId,
        workspaceId: seeded.workspaceId,
        goal: 'Open a running agent',
      }),
    ],
    sessionPhaseRuns: {
      [seeded.sessionId]: [
        anAgent({ id: seeded.agentId, sessionId: seeded.sessionId, status: 'running' }),
      ],
    },
    selectedAgentId: {},
    transcripts: {},
  });
});

describe('opening an agent that is still streaming', () => {
  it('keeps the stored history and the live events, each once, in order', async () => {
    afterTurnEventRead({ nth: 1, run: () => append({ label: 'live-one' }) });

    await useAppStore.getState().selectAgent(seeded.sessionId, seeded.agentId);
    expect(deltasOf()).toEqual(['live-one']);

    await vi.waitFor(() => {
      expect(useAppStore.getState().transcripts[seeded.agentId]).toHaveLength(STORED_ROWS + 1);
    });
    const rows = useAppStore.getState().transcripts[seeded.agentId] ?? [];
    expect(rows[0]).toMatchObject({ kind: 'user_text' });
    expect(deltasOf().filter((delta) => delta === 'live-one')).toHaveLength(1);
    expect(deltasOf().at(-1)).toBe('live-one');
  });

  it('keeps a live event that was not stored yet when the full read answered', async () => {
    const db = storySqlite();
    const select = db.select.bind(db);
    let reads = 0;
    vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      const rows = await select(sql, params);
      if (sql.includes('FROM turn_events')) {
        reads += 1;
        if (reads === 1) {
          append({ label: 'live-one' });
        }
        if (reads === 2) {
          append({ label: 'live-two' });
        }
      }
      return rows;
    });

    await useAppStore.getState().selectAgent(seeded.sessionId, seeded.agentId);

    await vi.waitFor(() => {
      expect(useAppStore.getState().transcripts[seeded.agentId]).toHaveLength(STORED_ROWS + 2);
    });
    expect(deltasOf().slice(-2)).toEqual(['live-one', 'live-two']);
  });

  it('drops the answer of an older open when a newer open already answered', async () => {
    const db = storySqlite();
    const select = db.select.bind(db);
    const gate = { open: (): void => undefined };
    const gated = new Promise<void>((resolve) => {
      gate.open = resolve;
    });
    let reads = 0;
    vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      if (!sql.includes('FROM turn_events')) {
        return select(sql, params);
      }
      reads += 1;
      if (reads === 1) {
        await gated;
        return [];
      }
      return select(sql, params);
    });

    const older = useAppStore.getState().selectAgent(seeded.sessionId, seeded.agentId);
    await useAppStore.getState().selectAgent(seeded.sessionId, seeded.agentId);
    await vi.waitFor(() => {
      expect(useAppStore.getState().transcripts[seeded.agentId]).toHaveLength(STORED_ROWS);
    });
    const afterNewer = useAppStore.getState().transcripts[seeded.agentId];

    gate.open();
    await older;

    expect(useAppStore.getState().transcripts[seeded.agentId]).toBe(afterNewer);
  });
});
