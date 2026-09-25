import { describe, expect, it } from 'vitest';
import type { StorageMountRow, StorageSessionRef } from '@goodboy/db';
import type {
  IsoDateTime,
  MountId,
  SessionId,
  WorkspaceId,
  WorktreeLedgerEntry,
} from '@goodboy/types';
import type { WorktreeFolderFacts } from '../../../features/worktree/worktree';
import { buildStorageFolders } from './buildStorageFolders';
import {
  isStorageFolderSuggested,
  storageFolderBucket,
  storageFolderStatus,
} from './classifyStorageFolder';
import { summarizeStorage } from './summarizeStorage';
import type { StorageFolder } from './types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-25T10:00:00.000Z');
const ISO = '2026-08-01T10:00:00.000Z' as IsoDateTime;

const mount = (overrides: Partial<StorageMountRow>): StorageMountRow => ({
  mountId: 'mount-live' as MountId,
  sessionId: 'session-live' as SessionId,
  workspaceId: 'harborline' as WorkspaceId,
  projectId: null,
  repoRoot: '/repos/ledger-core',
  worktreePath: '/repos/ledger-core/.goodboy/worktrees/live',
  branch: 'goodboy/live',
  revision: 1,
  sessionGoal: 'Close the ledger month',
  archivedAt: null,
  lastActivityAt: NOW - DAY,
  ...overrides,
});

const ledgerEntry = (overrides: Partial<WorktreeLedgerEntry>): WorktreeLedgerEntry => ({
  id: 'ledger-1',
  workspaceId: null,
  projectId: null,
  sourceSessionId: null,
  sourceMountId: null,
  repoRoot: '/repos/notify-relay',
  worktreePath: '/repos/notify-relay/.goodboy/worktrees/ghost',
  branch: '',
  reason: 'orphan',
  lastCheckedAt: null,
  firstSeenAt: ISO,
  sizeBytes: 2048,
  sizedAt: ISO,
  keptAt: null,
  keptUntil: null,
  createdAt: ISO,
  updatedAt: ISO,
  ...overrides,
});

const facts = (overrides: Partial<WorktreeFolderFacts>): WorktreeFolderFacts => ({
  path: '',
  exists: true,
  isRegistered: true,
  branch: 'goodboy/ghost',
  lastCommitAt: NOW - 40 * DAY,
  localOnlyCommits: 0,
  changedFiles: 0,
  changedSample: null,
  reasons: [],
  ...overrides,
});

const build = (params: {
  readonly mounts?: ReadonlyArray<StorageMountRow>;
  readonly ledger?: ReadonlyArray<WorktreeLedgerEntry>;
  readonly sessionRefs?: ReadonlyArray<StorageSessionRef>;
  readonly factList?: ReadonlyArray<WorktreeFolderFacts>;
}): ReadonlyArray<StorageFolder> =>
  buildStorageFolders({
    mounts: params.mounts ?? [],
    ledger: params.ledger ?? [],
    sessionRefs: params.sessionRefs ?? [],
    keptArchived: {},
    sizes: {},
    facts: new Map((params.factList ?? []).map((fact) => [fact.path, fact])),
  });

describe('buildStorageFolders', () => {
  it('labels live, archived and ledger folders and takes the branch from git for an orphan', () => {
    const archived = mount({
      mountId: 'mount-archived' as MountId,
      worktreePath: '/repos/ledger-core/.goodboy/worktrees/archived',
      archivedAt: NOW - 50 * DAY,
    });
    const deleted = ledgerEntry({
      id: 'ledger-deleted',
      worktreePath: '/repos/notify-relay/.goodboy/worktrees/deleted',
      sourceSessionId: 'session-deleted' as SessionId,
      sourceMountId: 'mount-deleted' as MountId,
      reason: 'session_delete',
      branch: 'goodboy/deleted',
    });

    const folders = build({
      mounts: [mount({}), archived],
      ledger: [ledgerEntry({}), deleted],
      sessionRefs: [
        {
          sessionId: 'session-deleted' as SessionId,
          goal: 'Rounding drift',
          archivedAt: null,
          deletedAt: NOW - 30 * DAY,
          lastActivityAt: NOW - 31 * DAY,
        },
      ],
      factList: [facts({ path: '/repos/notify-relay/.goodboy/worktrees/ghost' })],
    });

    expect(folders.map((folder) => [folder.origin, folder.why, folder.branch])).toEqual([
      ['in-use', 'active-session', 'goodboy/live'],
      ['archived', 'archived-session', 'goodboy/live'],
      ['ledger', 'no-session', 'goodboy/ghost'],
      ['ledger', 'deleted-session', 'goodboy/deleted'],
    ]);
    expect(folders[3]?.sessionGoal).toBe('Rounding drift');
  });

  it('drops a folder git says is gone', () => {
    const folders = build({
      ledger: [ledgerEntry({})],
      factList: [facts({ path: '/repos/notify-relay/.goodboy/worktrees/ghost', exists: false })],
    });

    expect(folders).toEqual([]);
  });
});

describe('classifying storage folders', () => {
  const base = (overrides: Partial<WorktreeFolderFacts>, keep?: Partial<StorageFolder>) =>
    ({
      ...build({
        ledger: [ledgerEntry({})],
        factList: [facts({ path: '/repos/notify-relay/.goodboy/worktrees/ghost', ...overrides })],
      })[0]!,
      ...keep,
    }) satisfies StorageFolder;

  it('suggests only clean folders idle past the threshold and not kept', () => {
    expect(isStorageFolderSuggested({ folder: base({}), now: NOW, suggestAfterDays: 30 })).toBe(
      true,
    );
    expect(isStorageFolderSuggested({ folder: base({}), now: NOW, suggestAfterDays: 60 })).toBe(
      false,
    );
    expect(
      isStorageFolderSuggested({
        folder: base({ changedFiles: 12, reasons: ['unstaged-changes'] }),
        now: NOW,
        suggestAfterDays: 30,
      }),
    ).toBe(false);
    expect(
      isStorageFolderSuggested({
        folder: base({}, { keptAt: NOW - DAY, keptUntil: null }),
        now: NOW,
        suggestAfterDays: 30,
      }),
    ).toBe(false);
  });

  it('brings a folder kept for thirty days back to review once the time is up', () => {
    const snoozed = base({}, { keptAt: NOW - 31 * DAY, keptUntil: NOW - DAY });

    expect(storageFolderBucket({ folder: snoozed, now: NOW })).toBe('review');
    expect(storageFolderBucket({ folder: snoozed, now: NOW - 2 * DAY })).toBe('kept');
  });

  it('names what blocks a folder, the lease and a git operation before the changes', () => {
    expect(storageFolderStatus({ folder: base({ reasons: ['writer-lease-held'] }) })).toBe(
      'writing',
    );
    expect(
      storageFolderStatus({
        folder: base({ reasons: ['operation-in-progress', 'unstaged-changes'], changedFiles: 1 }),
      }),
    ).toBe('operation');
    expect(storageFolderStatus({ folder: base({ reasons: ['not-registered'] }) })).toBe(
      'not-tracked',
    );
    expect(
      storageFolderStatus({ folder: base({ changedFiles: 2, reasons: ['untracked-files'] }) }),
    ).toBe('dirty');
  });

  it('keeps folders with commits never pushed in the safe bulk and counts them', () => {
    const summary = summarizeStorage({
      folders: [
        base({ localOnlyCommits: 2 }),
        base({ changedFiles: 1, reasons: ['unstaged-changes'] }),
      ],
      now: NOW,
      suggestAfterDays: 30,
    });

    expect(summary.canGo).toEqual({ count: 1, bytes: 2048 });
    expect(summary.reviewFirst).toEqual({ count: 1, bytes: 2048 });
    expect(summary.localCommitFolders).toBe(1);
  });
});
