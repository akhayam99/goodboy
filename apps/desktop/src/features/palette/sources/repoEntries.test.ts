import { describe, expect, it, vi } from 'vitest';
import type { ProjectId, WorkspaceGitStatus } from '@goodboy/types';
import { aProject } from '@goodboy/types/testing';
import { repoEntries } from './repoEntries';

const LEDGER = aProject({ name: 'ledger-core', baseBranch: 'main' });
const NOTIFY = aProject({ name: 'notify-relay', baseBranch: 'main' });
const PAYMENTS = aProject({ name: 'payments-api', baseBranch: 'develop' });
const NO_BASE = aProject({ name: 'harborline-web', baseBranch: null });
const FOLDER = aProject({ name: 'notes', kind: 'folder' });

const statusOn = (branch: string): WorkspaceGitStatus => ({
  state: 'ready',
  branch,
  headSubject: null,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  workingTree: { kind: 'known', staged: 0, unstaged: 0, untracked: 0, unmerged: 0, changed: 0 },
  upstream: null,
  inProgress: null,
});

const NO_STATUSES: Readonly<Record<ProjectId, WorkspaceGitStatus>> = {};

describe('the pull entries of the palette', () => {
  it('lists one row per repo naming the branch it updates, and an all row', () => {
    const entries = repoEntries({
      projects: [LEDGER, PAYMENTS, FOLDER],
      statuses: NO_STATUSES,
      pull: vi.fn(),
    });

    expect(entries.map((entry) => entry.label)).toEqual([
      'Pull main in all linked repos',
      'Pull main in ledger-core',
      'Pull develop in payments-api',
    ]);
  });

  it('says where the checkout stays when it is on a feature branch', () => {
    const entries = repoEntries({
      projects: [LEDGER, NOTIFY],
      statuses: { [LEDGER.id]: statusOn('mara/ledger-export'), [NOTIFY.id]: statusOn('main') },
      pull: vi.fn(),
    });

    expect(entries.find((entry) => entry.label.endsWith('ledger-core'))?.detail).toBe(
      'main · checkout stays on mara/ledger-export',
    );
    expect(entries.find((entry) => entry.label.endsWith('notify-relay'))?.detail).toBe('main');
  });

  it('falls back to the default branch wording when no base branch is set', () => {
    const entries = repoEntries({ projects: [NO_BASE], statuses: NO_STATUSES, pull: vi.fn() });

    expect(entries.map((entry) => entry.label)).toEqual([
      'Pull the default branch in harborline-web',
    ]);
  });

  it('has no all row for a single repo and nothing for a folder only workspace', () => {
    expect(repoEntries({ projects: [LEDGER], statuses: NO_STATUSES, pull: vi.fn() })).toHaveLength(
      1,
    );
    expect(repoEntries({ projects: [FOLDER], statuses: NO_STATUSES, pull: vi.fn() })).toEqual([]);
  });

  it('pulls every repo from the all row and only its own from a repo row', () => {
    const pull = vi.fn();
    const entries = repoEntries({ projects: [LEDGER, PAYMENTS], statuses: NO_STATUSES, pull });

    entries[0]?.run();
    entries[2]?.run();

    expect(pull).toHaveBeenNthCalledWith(1, [LEDGER, PAYMENTS]);
    expect(pull).toHaveBeenNthCalledWith(2, [PAYMENTS]);
  });
});
