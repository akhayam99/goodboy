import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStorySession,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from './storyHarness';
import { STREAM_BUDGETS } from './slices/transcripts/streamBudgets';
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

const ROW_COUNT = 5000;

type ReadSample = {
  readonly rows: number;
  readonly bytes: number;
};

const countTurnEventReads = (): ReadonlyArray<ReadSample> => {
  const samples: ReadSample[] = [];
  const db = storySqlite();
  const select = db.select.bind(db);
  vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
    const rows = await select(sql, params);
    if (sql.includes('FROM turn_events')) {
      samples.push({ rows: rows.length, bytes: JSON.stringify(rows).length });
    }
    return rows;
  });
  return samples;
};

let useAppStore: StoryStore;
let seeded: SeededTurns;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  seeded = await seedStoredTurns({ rowCount: ROW_COUNT });
  const session = buildStorySession({
    id: seeded.sessionId,
    workspaceId: seeded.workspaceId,
    goal: 'Open a long session',
  });
  useAppStore.setState({
    sessions: [session],
    sessionPhaseRuns: {
      [seeded.sessionId]: [
        {
          id: seeded.agentId,
          sessionId: seeded.sessionId,
          ordinal: 1,
          name: 'Agent 1',
          status: 'completed',
        },
      ],
    },
    selectedAgentId: {},
    transcripts: {},
  });
});

describe('opening a session with 5,000 stored turn events', () => {
  it('puts a bounded number of rows and bytes in front of the view first', async () => {
    const reads = countTurnEventReads();
    const painted: ReadSample[] = [];
    const unsubscribe = useAppStore.subscribe((state, previous) => {
      const rows = state.transcripts[seeded.agentId];
      if (rows === undefined || rows === previous.transcripts[seeded.agentId]) {
        return;
      }
      painted.push({ rows: rows.length, bytes: JSON.stringify(rows).length });
    });

    await useAppStore.getState().selectAgent(seeded.sessionId, seeded.agentId);
    unsubscribe();

    const first = painted[0];
    expect(first).toBeDefined();
    expect(first!.rows).toBeLessThanOrEqual(STREAM_BUDGETS.initialTranscriptRows);
    expect(first!.bytes).toBeLessThanOrEqual(STREAM_BUDGETS.initialTranscriptBytes);
    expect(reads[0]!.rows).toBeLessThanOrEqual(STREAM_BUDGETS.initialTranscriptRows);
    expect(reads[0]!.bytes).toBeLessThanOrEqual(STREAM_BUDGETS.initialTranscriptBytes);
  });

  it('reads the rest in one second pass and counts what it reads', async () => {
    const reads = countTurnEventReads();

    await useAppStore.getState().selectAgent(seeded.sessionId, seeded.agentId);
    await vi.waitFor(() => {
      expect(useAppStore.getState().transcripts[seeded.agentId]?.length).toBe(ROW_COUNT);
    });

    expect(reads.map((read) => read.rows)).toEqual([
      STREAM_BUDGETS.initialTranscriptRows,
      ROW_COUNT,
    ]);
    const viewBytes = JSON.stringify(useAppStore.getState().transcripts[seeded.agentId]).length;
    expect(viewBytes).toBeGreaterThan(reads[0]!.bytes);
  });
});
