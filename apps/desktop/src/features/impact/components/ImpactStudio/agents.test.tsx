// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);
vi.mock('../../../chat/turn', async () =>
  (await import('../../../../store/storyHarness')).turnModuleMock(),
);
vi.mock('../../../permissions/permissions', async () =>
  (await import('../../../../store/storyHarness')).permissionsModuleMock(),
);
vi.mock('../../../providers/providers', async () =>
  (await import('../../../../store/storyHarness')).providersModuleMock(),
);
vi.mock('../../../providers/routing', async () =>
  (await import('../../../../store/storyHarness')).routingModuleMock(),
);
vi.mock('../../../budget/budget', async () =>
  (await import('../../../../store/storyHarness')).budgetModuleMock(),
);
vi.mock('../../../workflows/workflows', async () =>
  (await import('../../../../store/storyHarness')).workflowsModuleMock(),
);
vi.mock('../../../worktree/worktree', async () =>
  (await import('../../../../store/storyHarness')).worktreeModuleMock(),
);
vi.mock('../../../../shared/lib/repo', async () =>
  (await import('../../../../store/storyHarness')).repoModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { insertWorkspace, type Database } from '@goodboy/db';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ImpactStudio } from './index';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const DAY_MS = 86_400_000;
const NOW = Date.now();
const INSIGHT_SQL = /GROUP BY step_role, provider, model, effort/;
const ROUTING_WORDS = /Balanced|In order|most room|Send new steps to|Auto routing/;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });

type SpanSeed = {
  readonly id: string;
  readonly role: string;
  readonly provider: string;
  readonly model: string;
  readonly effort: string | null;
  readonly endedAt: number;
  readonly endReason?: string;
  readonly costUsd: number;
};

type SeedParams = {
  readonly db: Database;
  readonly span: SpanSeed;
};

const seedSpan = async ({ db, span }: SeedParams) => {
  await db.execute(
    `INSERT INTO agent_turn_spans
       (run_id, workspace_id, step_role, provider, model, effort, started_at, ended_at,
        end_reason, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      span.id,
      WORKSPACE_ID,
      span.role,
      span.provider,
      span.model,
      span.effort,
      span.endedAt - 60_000,
      span.endedAt,
      span.endReason ?? 'succeeded',
      span.costUsd,
    ],
  );
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  await seedSpan({
    db,
    span: {
      id: 'run-today',
      role: 'implementer',
      provider: 'anthropic',
      model: 'claude-sonnet-5-5',
      effort: 'medium',
      endedAt: NOW - 60_000,
      costUsd: 1.5,
    },
  });
  await seedSpan({
    db,
    span: {
      id: 'run-codex',
      role: 'implementer',
      provider: 'codex',
      model: 'gpt-5.5-codex',
      effort: 'high',
      endedAt: NOW - 2 * DAY_MS,
      endReason: 'failed',
      costUsd: 0.5,
    },
  });
  await seedSpan({
    db,
    span: {
      id: 'run-older',
      role: 'scout',
      provider: 'anthropic',
      model: 'claude-haiku-5-5',
      effort: null,
      endedAt: NOW - 20 * DAY_MS,
      costUsd: 0.25,
    },
  });
  useAppStore.setState({ workspaces: [workspace], currentWorkspaceId: WORKSPACE_ID });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type SelectSpy = {
  readonly insightSql: () => ReadonlyArray<ReadonlyArray<unknown>>;
};

const spySelects = (): SelectSpy => {
  const db = storySqlite();
  const select = db.select.bind(db);
  const calls: Array<ReadonlyArray<unknown>> = [];
  vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
    if (INSIGHT_SQL.test(sql)) {
      calls.push(params ?? []);
    }
    return select(sql, params);
  });
  return { insightSql: () => calls };
};

const tileText = (label: string): string =>
  screen.getByText(label).closest('[data-stat-label]')?.parentElement?.textContent ?? '';

const renderStudio = () => render(<ImpactStudio workspaceId={WORKSPACE_ID} onClose={vi.fn()} />);

describe('Impact, Agents tab', () => {
  it('never reads agent turns until the tab opens, then once per window', async () => {
    const spy = spySelects();
    renderStudio();

    await screen.findByRole('tab', { name: 'Agents' });
    fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));
    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));
    await screen.findByText('Median wall-clock');
    expect(spy.insightSql()).toHaveLength(0);

    fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));
    await waitFor(() => expect(tileText('Agent turns')).toContain('2'));
    fireEvent.click(screen.getByRole('tab', { name: '30 days' }));
    await waitFor(() => expect(tileText('Agent turns')).toContain('3'));
    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));
    await waitFor(() => expect(tileText('Agent turns')).toContain('2'));

    expect(spy.insightSql()).toHaveLength(2);
  });

  it('shows roles by turns, and a role opens to its models', async () => {
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));

    const table = await screen.findByRole('table', { name: 'Agent turns by role' });
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole('row')
          .map((row) => row.dataset['role']),
      ).toEqual([undefined, 'implementer', 'scout']),
    );
    expect(tileText('Roles used')).toContain('2');
    expect(tileText('Cost on agent turns')).toContain('$2.25');
    expect(tileText('Pinned by you')).toContain('Known for 0 of 3 turns');

    const toggle = screen.getByRole('button', { name: 'Implementer models' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);

    const models = screen.getByRole('table', { name: 'Implementer models' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(within(models).getAllByRole('row')).toHaveLength(3);
    expect(models.textContent).toContain('High 100%');
    expect(document.body.textContent ?? '').not.toMatch(ROUTING_WORDS);
  });

  it('drops a late answer for a window the owner already left', async () => {
    const db = storySqlite();
    const select = db.select.bind(db);
    const held: Array<() => void> = [];
    const settled: Array<number> = [];
    vi.spyOn(db, 'select').mockImplementation(async (sql, params) => {
      const sinceMs = Number(params?.[1] ?? 0);
      if (!INSIGHT_SQL.test(sql) || sinceMs >= NOW - 8 * DAY_MS) {
        return select(sql, params);
      }
      await new Promise<void>((resolve) => held.push(resolve));
      const rows = await select(sql, params);
      settled.push(sinceMs);
      return rows;
    });
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));
    await waitFor(() => expect(held).toHaveLength(1));
    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));
    await waitFor(() => expect(tileText('Agent turns')).toContain('2'));

    held.forEach((release) => release());
    await waitFor(() => expect(settled).toHaveLength(1));
    await act(async () => undefined);

    expect(tileText('Agent turns')).toContain('2');
    expect(screen.queryByRole('button', { name: 'Scout models' })).toBeNull();
  });

  it('shows a failed read as an error strip and reads again on retry', async () => {
    injectDbFault({ match: INSIGHT_SQL });
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));

    const retry = await screen.findByRole('button', { name: /retry/i });
    expect(tileText('Agent turns')).toContain('not loaded');
    fireEvent.click(retry);

    await waitFor(() => expect(tileText('Agent turns')).toContain('3'));
  });
});
