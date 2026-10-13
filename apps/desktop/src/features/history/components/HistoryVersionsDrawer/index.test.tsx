// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    getDraftHistoryPlan: vi.fn(async () => null),
  }),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { HistoryBackup, HistoryBackupFacts, SessionProjectMount } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
} from '../../../../store/storyHarness';
import { formatDayMonth } from '../../../../shared/utils/time/formatDayMonth';
import { LEDGER, LEDGER_COMMITS, LEDGER_GRAPH } from '../../testing/ledgerFixture';
import { A_REBASE_MOUNT_ID, A_REBASE_SESSION_ID, aRebaseRun } from '../../testing/aRebaseRun';
import { HistoryVersionsDrawer } from './index';

const OLD_REF = 'refs/goodboy/backup/b-686c2f6c6564676572/1789900000000000000';
const NEWER_REF = 'refs/goodboy/backup/b-686c2f6c6564676572/1789950000000000000';
const project = aProject({ name: 'payments-api', baseBranch: 'main' });
const mount: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: project.id,
  mountName: 'payments-api',
  worktreePath: '/w/payments',
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'hl/ledger-export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

let store: Awaited<ReturnType<typeof importStore>>;
let backups: ReadonlyArray<HistoryBackup> = [];
const facts = new Map<string, HistoryBackupFacts>();

type BackupParams = {
  readonly overrides: Partial<HistoryBackup>;
};

const backup = ({ overrides }: BackupParams): HistoryBackup => ({
  refName: OLD_REF,
  sha: LEDGER.a,
  subject: 'Add ledger export endpoint',
  createdAt: 1_789_900_000,
  isLegacy: false,
  ...overrides,
});

type SeedParams = {
  readonly run?: ReturnType<typeof aRebaseRun>;
};
const seed = ({ run }: SeedParams = {}) => {
  const restoreHistory = vi.fn(async () => 'restored' as const);
  store.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [project],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [mount] },
    restoreHistory,
    loadHistoryDraft: async () => undefined,
    historyRuns: run === undefined ? {} : { [A_REBASE_MOUNT_ID]: run },
    historyDrafts: {
      [A_REBASE_MOUNT_ID]: {
        sessionId: A_REBASE_SESSION_ID,
        mountId: A_REBASE_MOUNT_ID,
        planId: 'plan-1',
        branch: mount.branch,
        baseSha: LEDGER_GRAPH.mergeBase.sha,
        headSha: LEDGER_COMMITS[0]?.sha ?? LEDGER.f,
        commits: LEDGER_COMMITS,
        items: [],
        onto: null,
        graph: LEDGER_GRAPH,
        undo: [],
        prediction: null,
        isPredicting: false,
        loadError: null,
      },
    },
  });
  return restoreHistory;
};

const renderDrawer = () =>
  render(
    <HistoryVersionsDrawer
      sessionId={A_REBASE_SESSION_ID}
      mountId={A_REBASE_MOUNT_ID}
      worktreePath="/w/payments"
      onClose={() => undefined}
    />,
  );

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  backups = [];
  facts.clear();
  stubStoryInvoke({
    worktree_status: () => ({
      branch: mount.branch,
      head: LEDGER.f,
      headSubject: 'Acme export',
      upstream: 'origin/hl/ledger-export',
      upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
      mainDistance: { kind: 'known', ahead: 7, behind: 3 },
      workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
      inProgress: null,
    }),
    history_backups_list: () => backups,
    history_backup_facts: (args: unknown) => {
      const sha =
        typeof args === 'object' && args !== null && 'backupSha' in args
          ? String(args.backupSha)
          : '';
      return facts.get(sha) ?? null;
    },
  });
});

afterEach(cleanup);

describe('HistoryVersionsDrawer', () => {
  it('says there is nothing to go back to when no version exists', async () => {
    seed();
    renderDrawer();

    expect(await screen.findByText(/No previous versions yet/)).toBeDefined();
  });

  it('shows when, why, how many commits and the difference with now, then the commits', async () => {
    seed();
    backups = [backup({ overrides: {} })];
    facts.set(LEDGER.a, {
      commits: [
        { sha: LEDGER.a, subject: 'Add ledger export endpoint' },
        { sha: LEDGER.b, subject: 'Stream rows in batches of 500' },
      ],
      isSameForkAsNext: false,
      nextCommitCount: 2,
      filesChangedVsNow: 3,
      additionsVsNow: 12,
      deletionsVsNow: 4,
    });
    renderDrawer();

    expect(await screen.findByText('Before a rebase')).toBeDefined();
    expect(screen.getByText('2 commits')).toBeDefined();
    expect(screen.getByText(/Now: \+\d+ \/ -\d+ commits, 3 files changed/)).toBeDefined();
    expect(screen.queryByText('Stream rows in batches of 500')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show commits' }));

    expect(screen.getByText('Stream rows in batches of 500')).toBeDefined();
  });

  it('resets only after the anchored confirm and names the version it restores', async () => {
    const restoreHistory = seed();
    const found = backup({ overrides: {} });
    backups = [found];
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: 'Reset branch to this version' }));
    const day = formatDayMonth({ at: found.createdAt * 1000 });
    const dialog = screen.getByRole('dialog', {
      name: `Reset the branch to the version from ${day}?`,
    });
    expect(within(dialog).getByText(/backed up first/)).toBeDefined();
    expect(restoreHistory).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset branch' }));

    await waitFor(() =>
      expect(restoreHistory).toHaveBeenCalledWith({
        sessionId: A_REBASE_SESSION_ID,
        mountId: A_REBASE_MOUNT_ID,
        backupRef: OLD_REF,
        shouldPush: true,
      }),
    );
  });

  it('offers no reset for an older version it cannot prove belongs to this branch', async () => {
    seed();
    backups = [
      backup({ overrides: {} }),
      backup({
        overrides: { refName: NEWER_REF, sha: LEDGER.b, createdAt: 1_789_950_000, isLegacy: true },
      }),
    ];
    renderDrawer();

    expect(await screen.findByText('Older version, read-only')).toBeDefined();
    expect(screen.getAllByRole('button', { name: 'Reset branch to this version' })).toHaveLength(1);
  });

  it('offers Undo right after a reset and restores the history it kept', async () => {
    const restoreHistory = seed({ run: aRebaseRun({ phase: 'restored', backupRef: NEWER_REF }) });
    backups = [backup({ overrides: {} })];
    renderDrawer();

    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

    await waitFor(() =>
      expect(restoreHistory).toHaveBeenCalledWith({
        sessionId: A_REBASE_SESSION_ID,
        mountId: A_REBASE_MOUNT_ID,
        backupRef: NEWER_REF,
        shouldPush: false,
      }),
    );
  });
});
