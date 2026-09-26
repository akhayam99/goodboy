// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ArtifactId, SessionId, WorkspaceId } from '@goodboy/types';
import type { StorageArtifact, StorageFolder } from '../../../../store/slices/storage/types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const facts = (path: string, overrides: Partial<NonNullable<StorageFolder['facts']>> = {}) => ({
  path,
  exists: true,
  isRegistered: true,
  branch: null,
  lastCommitAt: NOW - 40 * DAY,
  localOnlyCommits: 0,
  changedFiles: 0,
  changedSample: null,
  reasons: [],
  ...overrides,
});

const folder = (name: string, overrides: Partial<StorageFolder> = {}): StorageFolder => {
  const path = `/repos/ledger-core/.goodboy/worktrees/${name}`;
  return {
    path,
    repoRoot: '/repos/ledger-core',
    branch: `goodboy/${name}`,
    origin: 'ledger',
    why: 'deleted-session',
    sessionId: null,
    sessionGoal: null,
    mountId: null,
    revision: null,
    ledgerId: name,
    workspaceId: 'harborline' as WorkspaceId,
    sessionActivityAt: null,
    sizeBytes: 4 * 1024 ** 3,
    sizedAt: NOW,
    facts: facts(path),
    keptAt: null,
    keptUntil: null,
    ...overrides,
  };
};

const { state } = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
}));

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
  }),
}));

vi.mock('../../../../app/components/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));

import { StoragePage } from './index';

const safeIdle = folder('rounding-drift', {
  facts: facts('/repos/ledger-core/.goodboy/worktrees/rounding-drift', { localOnlyCommits: 2 }),
});
const dirty = folder('ledger-close', {
  facts: facts('/repos/ledger-core/.goodboy/worktrees/ledger-close', {
    changedFiles: 12,
    changedSample: 'src/settle/close.rs',
    reasons: ['unstaged-changes'],
  }),
});
const untracked = folder('fx-rates', {
  why: 'no-session',
  facts: facts('/repos/ledger-core/.goodboy/worktrees/fx-rates', {
    isRegistered: false,
    lastCommitAt: null,
    reasons: ['not-registered'],
  }),
});
const recent = folder('charge-reconcile', {
  facts: facts('/repos/ledger-core/.goodboy/worktrees/charge-reconcile', {
    lastCommitAt: NOW - 9 * DAY,
  }),
});

const orphanArtifact = (id: string, overrides: Partial<StorageArtifact> = {}): StorageArtifact => ({
  id: id as ArtifactId,
  kind: 'report',
  title: 'Settlement batch sizing',
  sessionGoal: 'Settle batch retry',
  deletedAt: NOW - 52 * DAY,
  updatedAt: NOW - 61 * DAY,
  openedAt: null,
  keptAt: null,
  keptUntil: null,
  sessionId: 'session-gone' as SessionId,
  workspaceId: 'harborline' as WorkspaceId,
  workspaceName: 'Harborline',
  workspaceSlug: 'harborline',
  folder: `2026-07-01-settlement-batch-sizing-${id}`,
  sizeBytes: 96 * 1024,
  ...overrides,
});

const unusedReport = orphanArtifact('unused');
const openedReport = orphanArtifact('opened', {
  title: 'Payments API latency review',
  openedAt: NOW - 2 * DAY,
});
const freshPlan = orphanArtifact('fresh', {
  kind: 'plan',
  title: 'Close the ledger month',
  deletedAt: NOW - 3 * DAY,
  updatedAt: NOW - 3 * DAY,
});

beforeEach(() => {
  Object.assign(state, {
    storageArtifacts: [unusedReport, openedReport, freshPlan],
    storageDeletingArtifacts: {},
    openStorageArtifact: vi.fn(async () => undefined),
    keepStorageArtifact: vi.fn(async () => undefined),
    deleteStorageArtifacts: vi.fn(async () => ({ deleted: 1, failed: [] })),
    storageStats: {
      databaseBytes: 187 * 1024 ** 2,
      archivedSessionCount: 41,
      archivedTranscriptRows: 10,
      archivedTranscriptBytes: 212 * 1024 ** 2,
      snapshotBytes: 204 * 1024 ** 2,
      snapshotCount: 2,
      appDataFolder: '/app-data',
      diskFreeBytes: 61 * 1024 ** 3,
      checkedAt: NOW,
    },
    storageStatsLoading: false,
    storageFolders: [safeIdle, dirty, untracked, recent],
    storageRoots: [
      {
        repoRoot: '/repos/ledger-core',
        projectName: 'ledger-core',
        workspaceId: 'harborline',
        workspaceName: 'Harborline',
        isDisconnected: false,
      },
    ],
    storageFocus: null,
    storageOutcome: null,
    storageRemovingPaths: {},
    storageMeasuringPath: null,
    settings: {},
    loadStorage: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
    focusStorage: vi.fn(),
    dismissStorageOutcome: vi.fn(),
    removeStorageFolders: vi.fn(async () => ({ removed: 1, freedBytes: 0, kept: [] })),
    keepStorageFolder: vi.fn(async () => undefined),
    pruneArchivedTranscripts: vi.fn(async () => 0),
    saveSetting: vi.fn(async () => undefined),
    scanStorageRepository: vi.fn(async () => undefined),
    setCurrentSession: vi.fn(async () => undefined),
  });
});

afterEach(() => {
  cleanup();
});

describe('StoragePage', () => {
  it('leads with what can go and states every folder with a word', () => {
    render(<StoragePage />);

    expect(screen.getByText('4.0 GB can go')).toBeDefined();
    expect(screen.getByText('61 GB free on this disk')).toBeDefined();
    expect(screen.getByText('12 files not committed')).toBeDefined();
    expect(screen.getByText("Git doesn't track this folder")).toBeDefined();
    expect(screen.getByText(/2 commits only on this Mac/)).toBeDefined();
    expect(screen.getByText(/idle under 30 days/)).toBeDefined();
  });

  it('bulk removes only clean idle folders and never offers the dirty or untracked ones', () => {
    render(<StoragePage />);

    fireEvent.click(screen.getByRole('button', { name: /Remove 1 safe folder/ }));

    const dirtyBox = screen.getByRole('checkbox', { name: 'Select goodboy/ledger-close' });
    const untrackedBox = screen.getByRole('checkbox', { name: 'Select goodboy/fx-rates' });
    expect((dirtyBox as HTMLInputElement).disabled).toBe(true);
    expect((untrackedBox as HTMLInputElement).disabled).toBe(true);
    const confirm = screen.getByRole('group', { name: /Remove 1 folder/ });
    expect(
      within(confirm).getByText(/including 1 with commits that were never pushed/),
    ).toBeDefined();

    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove' }));

    expect(state.removeStorageFolders).toHaveBeenCalledWith({
      paths: [safeIdle.path],
      mode: 'safe',
    });
  });

  it('asks before removing a dirty folder anyway and uses the confirmed mode', () => {
    render(<StoragePage />);
    const row = screen
      .getAllByTestId('storage-folder-row')
      .find((candidate) => candidate.getAttribute('data-status') === 'dirty');

    fireEvent.click(within(row!).getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Remove anyway/ }));

    const confirm = screen.getByRole('group', { name: /12 changed files will be lost/ });
    expect(within(confirm).getByText(/src\/settle\/close.rs and 11 more/)).toBeDefined();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Remove folder' }));

    expect(state.removeStorageFolders).toHaveBeenCalledWith({
      paths: [dirty.path],
      mode: 'confirmed',
    });
  });

  it('keeps a folder for thirty days from its menu', () => {
    render(<StoragePage />);
    const row = screen
      .getAllByTestId('storage-folder-row')
      .find((candidate) => candidate.getAttribute('data-status') === 'not-tracked');

    fireEvent.click(within(row!).getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Keep for 30 days' }));

    expect(state.keepStorageFolder).toHaveBeenCalledWith({ path: untracked.path, days: 30 });
  });

  it('lists artifacts of deleted sessions and says why a row is not suggested', () => {
    render(<StoragePage />);

    const section = screen.getByRole('region', { name: 'Artifacts from deleted sessions' });
    expect(within(section).getAllByTestId('storage-artifact-row')).toHaveLength(3);
    expect(within(section).getByText(/used recently, not suggested/)).toBeDefined();
    expect(within(section).getByText(/deleted under 30 days ago/)).toBeDefined();
    expect(screen.getByText('Artifact copies')).toBeDefined();
  });

  it('bulk deletes only unused artifacts after a confirm', () => {
    render(<StoragePage />);
    const section = screen.getByRole('region', { name: 'Artifacts from deleted sessions' });

    fireEvent.click(within(section).getByRole('button', { name: /Delete 1 unused/ }));
    const confirm = within(section).getByRole('group', { name: /Delete 1 artifact/ });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(state.deleteStorageArtifacts).toHaveBeenCalledWith({ ids: [unusedReport.id] });
  });

  it('keeps an artifact for thirty days from its keep menu', () => {
    render(<StoragePage />);
    const row = screen.getAllByTestId('storage-artifact-row')[1];

    fireEvent.click(within(row!).getByRole('button', { name: 'Keep' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'For 30 days' }));

    expect(state.keepStorageArtifact).toHaveBeenCalledWith({ id: openedReport.id, days: 30 });
  });

  it('asks before deleting one artifact with its copy and its record', () => {
    render(<StoragePage />);
    const row = screen.getAllByTestId('storage-artifact-row')[2];

    fireEvent.click(within(row!).getByRole('button', { name: 'Delete' }));
    const confirm = screen.getByRole('group', { name: /Delete this plan/ });
    expect(within(confirm).getByText(/copy on disk and its record in Goodboy/)).toBeDefined();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Delete' }));

    expect(state.deleteStorageArtifacts).toHaveBeenCalledWith({ ids: [freshPlan.id] });
  });
});
