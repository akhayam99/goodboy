const emitAlerts = vi.hoisted(() => ({ invokeBudgetEmitAlerts: vi.fn() }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../features/budget/budget', async () => ({
  ...(await import('../../storyHarness')).budgetModuleMock(),
  ...emitAlerts,
}));

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace } from '@goodboy/db';
import type { BudgetAlert, IsoDateTime, ProviderRunId, SessionId, TurnEvent } from '@goodboy/types';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySpies,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';
import { recordUsageTelemetry } from './recordUsageTelemetry';

const NOW = '2026-08-02T12:00:00.000Z' as IsoDateTime;
const workspace = aWorkspace({ name: 'Harborline' });
const session = aSession({ workspaceId: workspace.id, goal: 'Finish the budget path' });
const SESSION_ID: SessionId = session.id;

const alert = {
  id: 'alert-1',
  kind: 'session-exceeded',
  sessionId: SESSION_ID,
  currentUsd: 12.3,
  capUsd: 10,
  createdAt: NOW,
} satisfies BudgetAlert;

const usage = {
  inputTokens: 1_000,
  outputTokens: 500,
  cachedInputTokens: 0,
  estimatedCostUsd: 2.5,
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await insertSession(db, session);
  useAppStore.setState({ workspaces: [workspace], sessions: [session] });
  storySpies.invokeBudgetAlertsList.mockResolvedValue([alert]);
  emitAlerts.invokeBudgetEmitAlerts.mockReset();
  emitAlerts.invokeBudgetEmitAlerts.mockResolvedValueOnce([alert]).mockResolvedValueOnce([]);
});

const recordTurn = async (runId: ProviderRunId) => {
  await storySqlite().execute(
    `INSERT INTO provider_runs (id, session_id, provider, model, status_kind, created_at)
     VALUES (?, ?, 'anthropic', 'claude-sonnet-4-5', 'succeeded', ?)`,
    [runId, SESSION_ID, Date.parse(NOW)],
  );
  await recordUsageTelemetry(useAppStore.setState, useAppStore.getState, {
    event: { kind: 'usage', runId, usage, at: NOW } satisfies Extract<TurnEvent, { kind: 'usage' }>,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    runId,
    sessionId: SESSION_ID,
    now: () => NOW,
  });
};

const budgetNotifications = () =>
  useAppStore.getState().notifications.filter((entry) => entry.kind === 'budget-cap');

describe('recordUsageTelemetry', () => {
  it('stores the turn usage in the database and in the session telemetry', async () => {
    await recordTurn('run-1' as ProviderRunId);

    const rows = await rowsOf<{ run_id: string; input_tokens: number; output_tokens: number }>({
      sql: 'SELECT run_id, input_tokens, output_tokens FROM telemetry_records WHERE session_id = ?',
      params: [SESSION_ID],
    });
    expect(rows).toEqual([{ run_id: 'run-1', input_tokens: 1_000, output_tokens: 500 }]);
    expect(
      useAppStore.getState().sessionTelemetry[SESSION_ID]?.map((entry) => entry.runId),
    ).toEqual(['run-1']);
  });

  it('emits one notification for the first session cap breach and none for the next turn', async () => {
    await recordTurn('run-1' as ProviderRunId);

    expect(
      budgetNotifications().map(({ severity, title, body, sessionId }) => ({
        severity,
        title,
        body,
        sessionId,
      })),
    ).toEqual([
      {
        severity: 'error',
        title: 'Finish the budget path paused its workflows at the $10.00 spend cap.',
        body: '$12.30 spent so far.',
        sessionId: SESSION_ID,
      },
    ]);

    await recordTurn('run-2' as ProviderRunId);

    expect(budgetNotifications()).toHaveLength(1);
    expect(useAppStore.getState().sessionTelemetry[SESSION_ID]).toHaveLength(2);
  });
});
