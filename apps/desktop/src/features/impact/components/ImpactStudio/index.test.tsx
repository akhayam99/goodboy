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
vi.mock('../../../skills/skills', async () =>
  (await import('../../../../store/storyHarness')).skillsModuleMock(),
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
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  insertSession,
  insertTelemetry,
  insertWorkspace,
  purgeSessionForDelete,
  type Database,
} from '@goodboy/db';
import type {
  IsoDateTime,
  ProviderRunId,
  SessionId,
  TelemetryKind,
  TelemetryRecordId,
  WorkspaceId,
} from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { SpendButton } from '../../../../app/components/AppTopBar/SpendButton';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySqlite,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ImpactStudio } from './index';

const WORKSPACE_ID = 'workspace-harborline' as WorkspaceId;
const LIVE = 'session-payout-hold' as SessionId;
const ARCHIVED = 'session-export-cron' as SessionId;
const GONE = 'session-ledger-export' as SessionId;
const GONE_TODAY = 'session-refund-split' as SessionId;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const NOW = Date.now();
const TODAY = Math.max(new Date(NOW).setHours(0, 0, 0, 0) + 60_000, NOW - HOUR_MS);

const iso = (ms: number): IsoDateTime => new Date(ms).toISOString() as IsoDateTime;

const workspace = buildStoryWorkspace({ id: WORKSPACE_ID, name: 'Harborline', slug: 'harborline' });

type SeedSessionParams = {
  readonly db: Database;
  readonly id: SessionId;
  readonly goal: string;
  readonly createdAt: number;
  readonly lastActivityAt: number;
};

const seedSession = async ({ db, id, goal, createdAt, lastActivityAt }: SeedSessionParams) => {
  const session = aSession({
    id,
    workspaceId: WORKSPACE_ID,
    goal,
    state: { kind: 'idle', lastActivityAt: iso(lastActivityAt) },
    createdAt: iso(createdAt),
    updatedAt: iso(lastActivityAt),
  });
  await insertSession(db, session);
  return session;
};

type SpendParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
  readonly id: string;
  readonly at: number;
  readonly cost: number;
  readonly kind?: TelemetryKind;
};

const seedSpend = async ({ db, sessionId, id, at, cost, kind = 'turn' }: SpendParams) => {
  await db.execute(
    `INSERT OR IGNORE INTO provider_runs (id, session_id, provider, model, status_kind, created_at)
     VALUES (?, ?, 'anthropic', 'claude-opus-5', 'succeeded', ?)`,
    [`run-${id}`, sessionId, at],
  );
  await insertTelemetry(db, {
    id: `telemetry-${id}` as TelemetryRecordId,
    runId: `run-${id}` as ProviderRunId,
    sessionId,
    kind,
    provider: 'anthropic',
    model: 'claude-opus-5',
    inputTokens: 1200,
    outputTokens: 300,
    estimatedCostUsd: cost,
    recordedAt: iso(at),
  });
};

const seedMergedPullRequest = async ({ db }: { readonly db: Database }) => {
  await db.execute(
    `INSERT INTO session_worktrees
       (id, session_id, worktree_path, branch, parallel_index, repo_slug, created_at)
     VALUES ('mount-ledger', ?, '/tmp/mount-ledger', 'mq/ledger-export', 0, 'acme/ledger-core', ?)`,
    [GONE, NOW - 20 * DAY_MS],
  );
  await db.execute(
    `INSERT INTO mount_pr_links
       (id, mount_id, provider, host, repo_slug, pr_number, head_branch, base_branch, url, state,
        snapshot_json, merged_at, last_observed_at, created_at, updated_at)
     VALUES ('link-412', 'mount-ledger', 'github', 'github.com', 'acme/ledger-core', 412,
             'mq/ledger-export', 'main', 'https://github.com/acme/ledger-core/pull/412', 'merged',
             '{"title":"Reconcile the ledger export"}', ?, ?, ?, ?)`,
    [NOW - 19 * DAY_MS, NOW - 19 * DAY_MS, NOW - 20 * DAY_MS, NOW - 19 * DAY_MS],
  );
};

let useAppStore: StoryStore;
const navigate = vi.fn();

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  navigate.mockReset();
  const db = await openStorySqlite();
  await insertWorkspace({ db, workspace });
  const live = await seedSession({
    db,
    id: LIVE,
    goal: 'Warn merchants before a payout hold',
    createdAt: TODAY - HOUR_MS,
    lastActivityAt: TODAY,
  });
  await seedSession({
    db,
    id: ARCHIVED,
    goal: 'Retire the legacy export cron job',
    createdAt: TODAY - HOUR_MS,
    lastActivityAt: TODAY,
  });
  await db.execute('UPDATE sessions SET archived_at = ? WHERE id = ?', [TODAY, ARCHIVED]);
  await seedSession({
    db,
    id: GONE,
    goal: 'Reconcile the ledger export',
    createdAt: NOW - 20 * DAY_MS,
    lastActivityAt: NOW - 20 * DAY_MS + 3 * HOUR_MS,
  });
  await seedSession({
    db,
    id: GONE_TODAY,
    goal: 'Split payments-api refunds',
    createdAt: TODAY - HOUR_MS,
    lastActivityAt: TODAY,
  });
  await seedSpend({ db, sessionId: LIVE, id: 'live-turn', at: TODAY, cost: 2.5 });
  await seedSpend({
    db,
    sessionId: LIVE,
    id: 'live-summary',
    at: TODAY,
    cost: 0.5,
    kind: 'summarizer',
  });
  await seedSpend({ db, sessionId: ARCHIVED, id: 'archived', at: TODAY, cost: 1 });
  await seedSpend({ db, sessionId: GONE_TODAY, id: 'gone-today', at: TODAY, cost: 1.5 });
  await seedSpend({ db, sessionId: GONE, id: 'gone', at: NOW - 20 * DAY_MS, cost: 4 });
  await seedMergedPullRequest({ db });
  await purgeSessionForDelete({ db, id: GONE });
  await purgeSessionForDelete({ db, id: GONE_TODAY });
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [live],
    navigate,
  });
  await useAppStore.getState().loadDormantSpend(WORKSPACE_ID);
});

afterEach(() => {
  cleanup();
});

const renderStudio = (onClose = vi.fn()) =>
  render(<ImpactStudio workspaceId={WORKSPACE_ID} onClose={onClose} />);

const tile = async (label: string): Promise<string> => {
  const eyebrow = await screen.findByText(label);
  return eyebrow.closest('button')?.textContent ?? '';
};

describe('ImpactStudio on the real database', () => {
  it('counts deleted sessions and their merged pull request over all time, under the Sessions tile', async () => {
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));

    await waitFor(async () => expect(await tile('Sessions')).toContain('2 deleted'));
    expect(await tile('Sessions')).toContain('4');
    expect(await tile('Pull requests merged')).toContain('1');
    expect(screen.queryByText(/Goodboy ran/)).toBeNull();
  });

  it('keeps a session deleted today out of an older window and a long one out of this week', async () => {
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));

    await waitFor(async () => expect(await tile('Sessions')).toContain('1 deleted'));
    expect(await tile('Sessions')).toContain('3');
    expect(await tile('Pull requests merged')).toContain('0');
  });

  it('shows a deleted session as a row that does not open', async () => {
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));

    const row = await screen.findByText('Reconcile the ledger export');
    const list = row.closest('li');

    expect(list).not.toBeNull();
    within(list as HTMLElement).getByText('Deleted');
    expect(within(list as HTMLElement).queryByRole('button')).toBeNull();
  });

  it('says the same spend in the Spend tab and the top bar chip', async () => {
    render(
      <>
        <SpendButton onOpenSpend={vi.fn()} />
        <ImpactStudio workspaceId={WORKSPACE_ID} onClose={vi.fn()} />
      </>,
    );
    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));
    await waitFor(async () => expect(await tile('Sessions')).toContain('1 deleted'));

    fireEvent.click(screen.getByRole('tab', { name: 'Spend' }));

    await waitFor(() => expect(screen.getAllByText('$5.50').length).toBeGreaterThanOrEqual(3));
    within(screen.getByRole('button', { name: /Spent today, counted by Goodboy/ })).getByText(
      '$5.50',
    );
  });

  it('opens a live session from its row and closes the studio', async () => {
    const onClose = vi.fn();
    renderStudio(onClose);
    fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

    fireEvent.click(
      await screen.findByRole('button', { name: /Warn merchants before a payout hold/ }),
    );

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('reports every scope change, so the navigation address stays honest', () => {
    const onScopeChange = vi.fn();
    render(
      <ImpactStudio workspaceId={WORKSPACE_ID} onClose={vi.fn()} onScopeChange={onScopeChange} />,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Flow' }));

    expect(onScopeChange).toHaveBeenCalledWith({ kind: 'flow' });
  });

  it('counts comments sent to an agent apart from the resolved ones', async () => {
    const db = storySqlite();
    await db.execute(
      `INSERT INTO diff_comments (id, session_id, file_path, body, status, created_at, resolved_at, consumed_at)
       VALUES ('c-resolved', ?, 'src/payout.ts', 'hold first', 'resolved', ?, ?, NULL),
              ('c-sent', ?, 'src/payout.ts', 'retry', 'consumed', ?, NULL, ?)`,
      [LIVE, TODAY, TODAY + 60_000, LIVE, TODAY, TODAY + 60_000],
    );
    renderStudio();

    fireEvent.click(screen.getByRole('tab', { name: 'Shipped' }));

    await screen.findByText('Sent to agent: 1');
    screen.getByText('Pushed resolutions: 0');
  });

  it('renders a failed overview as an error strip and loads it again on retry', async () => {
    injectDbFault({ match: /orchestrated_sessions/, message: 'database is locked' });
    renderStudio();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('database is locked');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));

    await waitFor(async () => expect(await tile('Sessions')).toContain('Sessions'));
  });
});

describe('ImpactStudio refreshes pull requests of sessions no longer on the board', () => {
  it('settles an open pull request of a deleted session once, when Impact opens', async () => {
    const db = storySqlite();
    await db.execute("UPDATE mount_pr_links SET state = 'open', merged_at = NULL");
    const calls: Array<ReadonlyArray<string>> = [];
    stubStoryInvoke({
      gh_run: ({ args }: { readonly args: ReadonlyArray<string> }) => {
        calls.push(args);
        return {
          stdout: JSON.stringify({
            number: 412,
            title: 'Reconcile the ledger export',
            url: 'https://github.com/acme/ledger-core/pull/412',
            state: 'MERGED',
            isDraft: false,
            mergeable: 'UNKNOWN',
            baseRefName: 'main',
            headRefName: 'mq/ledger-export',
            reviewDecision: null,
            statusCheckRollup: null,
            updatedAt: iso(TODAY),
            body: null,
            autoMergeRequest: null,
            mergedAt: iso(TODAY),
          }),
          stderr: '',
          exitCode: 0,
        };
      },
    });
    useAppStore.setState({ githubStatus: { mode: 'gh-cli', available: true } });
    renderStudio();
    fireEvent.click(screen.getByRole('tab', { name: '7 days' }));

    await waitFor(async () => expect(await tile('Pull requests merged')).toContain('1'));
    const events = await rowsOf<{ kind: string }>({
      sql: "SELECT kind FROM session_events WHERE session_id = ? AND kind = 'pr_merged'",
      params: [GONE],
    });
    expect(calls).toHaveLength(1);
    expect(events).toHaveLength(1);
  });
});
