// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type SessionId, type WorkspaceId } from '@goodboy/types';
import type { WorktreeFolderFacts } from '../worktree/worktree';
import type { TerminalTab, TerminalTabId } from '../../shared/types/terminal';
import type { StorageFolder } from '../../store/slices/storage/types';
import { tracksOfWorkspace } from './tracksOfWorkspace';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-11-20T10:00:00.000Z');
const REPO = '/repos/payments-api';

type FactsParams = {
  readonly path: string;
  readonly patch?: Partial<WorktreeFolderFacts>;
};

const factsOf = ({ path, patch = {} }: FactsParams): WorktreeFolderFacts => ({
  path,
  exists: true,
  isRegistered: true,
  branch: null,
  lastCommitAt: NOW - 2 * DAY,
  localOnlyCommits: 0,
  changedFiles: 0,
  changedSample: null,
  reasons: [],
  verdict: 'safe',
  ...patch,
});

type FolderParams = {
  readonly name: string;
  readonly patch?: Partial<StorageFolder>;
  readonly facts?: Partial<WorktreeFolderFacts> | null;
};

const folderOf = ({ name, patch = {}, facts = {} }: FolderParams): StorageFolder => {
  const path = `${REPO}/.goodboy/worktrees/${name}`;
  return {
    path,
    repoRoot: REPO,
    branch: `ac/${name}`,
    origin: 'in-use',
    why: 'active-session',
    sessionId: brandId<SessionId>({ value: `session-${name}` }),
    sessionGoal: `Acme ${name}`,
    mountId: brandId<MountId>({ value: `mount-${name}` }),
    revision: 1,
    ledgerId: null,
    workspaceId: brandId<WorkspaceId>({ value: 'acme' }),
    sessionActivityAt: NOW - DAY,
    sizeBytes: 100,
    sizedAt: NOW,
    facts: facts === null ? null : factsOf({ path, patch: facts }),
    keptAt: null,
    keptUntil: null,
    ...patch,
  };
};

const NO_TERMINALS: ReadonlyMap<string, ReadonlyArray<TerminalTab>> = new Map();

describe('tracksOfWorkspace', () => {
  it('lists every worktree of the project across sessions, the live ones first', () => {
    const archived = folderOf({
      name: 'refund-retry',
      patch: { origin: 'archived', why: 'archived-session', sessionActivityAt: NOW },
    });
    const live = folderOf({ name: 'ledger-sync', patch: { sessionActivityAt: NOW - 5 * DAY } });
    const other = folderOf({ name: 'notify', patch: { repoRoot: '/repos/notify-relay' } });

    const worktrees = tracksOfWorkspace({
      folders: [archived, other, live],
      repoRoot: REPO,
      terminals: NO_TERMINALS,
    });

    expect(worktrees.tracks.map((track) => track.folder.branch)).toEqual([
      'ac/ledger-sync',
      'ac/refund-retry',
    ]);
    expect(worktrees.count).toBe(2);
    expect(worktrees.sizeBytes).toBe(200);
  });

  it('counts only the folders Rust calls safe, and never one a terminal holds', () => {
    const clean = folderOf({ name: 'clean', patch: { sizeBytes: 700 } });
    const dirty = folderOf({ name: 'dirty', facts: { verdict: 'dirty', changedFiles: 3 } });
    const held = folderOf({ name: 'held' });
    const unread = folderOf({ name: 'unread', facts: null });
    const terminal: TerminalTab = {
      id: brandId<TerminalTabId>({ value: 'tab-1' }),
      owner: { kind: 'session', sessionId: brandId<SessionId>({ value: 'session-held' }) },
      title: 'zsh',
      cwd: held.path,
      status: 'running',
      createdAt: NOW,
    };

    const worktrees = tracksOfWorkspace({
      folders: [clean, dirty, held, unread],
      repoRoot: REPO,
      terminals: new Map([[held.path, [terminal]]]),
    });

    expect(worktrees.tracks.map((track) => [track.folder.branch, track.verdict])).toEqual(
      expect.arrayContaining([
        ['ac/clean', 'safe'],
        ['ac/dirty', 'dirty'],
        ['ac/held', 'terminal-open'],
        ['ac/unread', 'checking'],
      ]),
    );
    expect(worktrees.safe.map((track) => track.folder.branch)).toEqual(['ac/clean']);
    expect(worktrees.safeBytes).toBe(700);
  });

  it('says no size until one folder is measured', () => {
    const worktrees = tracksOfWorkspace({
      folders: [folderOf({ name: 'new', patch: { sizeBytes: null, sizedAt: null } })],
      repoRoot: REPO,
      terminals: NO_TERMINALS,
    });

    expect(worktrees.sizeBytes).toBeNull();
    expect(worktrees.count).toBe(1);
  });
});
