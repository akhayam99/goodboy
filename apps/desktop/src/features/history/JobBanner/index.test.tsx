// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProjectId, SessionProjectMount, WorktreeStatus } from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { mockSceneIpc } from '../../../app/components/MockScene/scenes/mockSceneIpc';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { useAppStore } from '../../../store';
import { resetWorktreeStatusCache } from '../../../store/slices/worktreeStatuses/cache';
import type { HistoryRun } from '../../../store/slices/history/types';
import { clearSceneInvoke } from '../../../test/sceneInvoke';
import {
  A_REBASE_AGENT_ID,
  A_REBASE_MOUNT_ID,
  A_REBASE_SESSION_ID,
  aRebaseRun,
} from '../testing/aRebaseRun';
import { JobBanner } from './index';
import { brandedId } from '../testing/brandedId';

const PROJECT_ID = brandedId<ProjectId>({ value: 'project-payments' });
const WORKTREE = '/w/payments-api';

const MOUNT: SessionProjectMount = {
  mountId: A_REBASE_MOUNT_ID,
  sessionId: A_REBASE_SESSION_ID,
  projectId: PROJECT_ID,
  mountName: 'payments-api',
  worktreePath: WORKTREE,
  lastWorktreePath: null,
  repoRoot: '/repos/payments-api',
  branch: 'hl/fix-duplicate-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const statusWith = ({ changed }: { readonly changed: number }): WorktreeStatus => ({
  branch: MOUNT.branch,
  head: 'head-sha',
  headSubject: 'Guard the settlement batch',
  upstream: `origin/${MOUNT.branch}`,
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
  mainDistance: { kind: 'known', ahead: 7, behind: 18 },
  workingTree: {
    kind: 'known',
    staged: changed,
    unstaged: 0,
    untracked: 0,
    unmerged: 0,
    changed,
  },
  inProgress: null,
});

const dirty = { changed: 11 };

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  dirty.changed = 0;
  mockSceneIpc((command) =>
    command === 'worktree_status' ? statusWith({ changed: dirty.changed }) : null,
  );
  useAppStore.setState({
    sessions: [aSession({ id: A_REBASE_SESSION_ID })],
    projects: [aProject({ id: PROJECT_ID, name: 'payments-api', baseBranch: 'main' })],
    sessionProjectMounts: { [A_REBASE_SESSION_ID]: [MOUNT] },
  });
});

afterEach(() => {
  cleanup();
  clearSceneInvoke();
});

const SETTLE_MS = 400;

const settle = (): Promise<void> =>
  act(() => new Promise<void>((resolve) => window.setTimeout(resolve, SETTLE_MS)));

const showRun = async (patch: Partial<HistoryRun>) => {
  useAppStore.setState({
    historyRuns: { [A_REBASE_MOUNT_ID]: aRebaseRun(patch) },
  });
  render(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
  await settle();
};

describe('the job banner', () => {
  it('has nothing to say without a run', async () => {
    render(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
    await settle();

    expect(screen.queryByRole('region', { name: 'Rebase job' })).toBeNull();
  });

  it('has nothing to say about a rewrite the user planned', async () => {
    await showRun({ origin: 'plan', phase: 'trying' });

    expect(screen.queryByRole('region', { name: 'Rebase job' })).toBeNull();
  });

  it.each([
    [{ phase: 'predicting' }, 'Rebasing payments-api on main', 'Checking the branch'],
    [{ phase: 'trying', commitCount: 7 }, 'Rebasing payments-api on main', 'Replaying 7 commits'],
    [
      { phase: 'trying', progress: { stage: 'step', index: 3, total: 7, sha: 'a1' } },
      'Rebasing payments-api on main',
      'Replaying 3 of 7',
    ],
    [
      {
        phase: 'rewriting',
        stop: { reason: 'conflict', message: '', files: ['webhook.ts'], sha: null },
      },
      'Rebasing payments-api on main',
      'History rewriter is merging webhook.ts in a copy',
    ],
    [
      { phase: 'rewriting', progress: { stage: 'check' } },
      'Rebasing payments-api on main',
      'Checking the result against your branch',
    ],
    [
      { phase: 'applying' },
      'Rebasing payments-api on main',
      'Moving the branch. A backup is saved first.',
    ],
    [
      { phase: 'pushing' },
      'Rebasing payments-api on main',
      'Updating the online copy with a safe force push',
    ],
  ] satisfies ReadonlyArray<readonly [Partial<HistoryRun>, string, string]>)(
    'shows a run in its %j phase',
    async (patch, title, line) => {
      await showRun(patch);

      const region = screen.getByRole('region', { name: 'Rebase job' });
      expect(region.textContent).toContain(title);
      expect(region.textContent).toContain(line);
      expect(screen.queryByRole('button')).toBeNull();
    },
  );

  it('offers to see what the rewriter did while it merges', async () => {
    await showRun({
      phase: 'rewriting',
      agentId: A_REBASE_AGENT_ID,
      stop: { reason: 'conflict', message: '', files: ['webhook.ts'], sha: null },
    });

    expect(screen.getByRole('button', { name: 'See what it did' })).toBeDefined();
  });

  it('says what a finished rebase did and offers the undo', async () => {
    dirty.changed = 11;
    await showRun({ phase: 'pushed', commitCount: 7, backupRef: 'refs/goodboy/backup/1' });

    const region = screen.getByRole('region', { name: 'Rebase job' });
    expect(region.textContent).toContain('Rebased on main');
    expect(region.textContent).toContain(
      '7 commits. Your 11 files were not touched. Backup kept for 30 days.',
    );
    expect(screen.getByRole('button', { name: 'Undo rewrite' })).toBeDefined();
  });

  it('asks nothing of a rebase that stopped on the origin, only to dismiss it', async () => {
    await showRun({
      phase: 'stopped',
      stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Someone pushed to the online copy');
    expect(alert.textContent).toContain('Nothing was pushed.');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Dismiss']);
  });

  it('opens the output of a failed push on Details', async () => {
    await showRun({
      phase: 'stopped',
      backupRef: 'refs/goodboy/backup/1',
      stop: {
        reason: 'push-failed',
        message: 'pre-push hook declined\nsrc/ledger/postCredit.ts 14:7 error',
        files: [],
        sha: null,
      },
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'A pre-push hook stopped it. Details has the output.',
    );
    expect(screen.queryByText(/postCredit\.ts 14:7 error/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByText(/postCredit\.ts 14:7 error/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeDefined();
  });

  it('sends a missing provider to Providers', async () => {
    const opened = vi.fn();
    window.addEventListener('goodboy:open-settings', opened);
    await showRun({
      phase: 'stopped',
      stop: { reason: 'no-provider', message: '', files: ['webhook.ts'], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open providers' }));

    expect(opened).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:open-settings', opened);
  });

  it('drops the run when the user dismisses it', async () => {
    await showRun({
      phase: 'stopped',
      stop: { reason: 'head-moved', message: 'moved', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await settle();

    expect(useAppStore.getState().historyRuns[A_REBASE_MOUNT_ID]).toBeUndefined();
    expect(screen.queryByRole('region', { name: 'Rebase job' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('a dirty tree stop', () => {
  const dirtyStop = { reason: 'dirty', message: 'unused', files: [], sha: null } as const;

  it('names the files, and leaves when the tree is clean again', async () => {
    dirty.changed = 11;
    await showRun({ phase: 'stopped', stop: dirtyStop });

    expect(screen.getByRole('alert').textContent).toContain(
      '11 files have changes that are not committed',
    );
    expect(screen.getByRole('button', { name: 'Check again' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open terminal' })).toBeDefined();

    dirty.changed = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await settle();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Rebase job' })).toBeNull();
  });

  it('stays while the tree is still dirty after checking again', async () => {
    dirty.changed = 11;
    await showRun({ phase: 'stopped', stop: dirtyStop });

    dirty.changed = 3;
    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await settle();

    expect(screen.getByRole('alert').textContent).toContain(
      '3 files have changes that are not committed',
    );
  });
});
