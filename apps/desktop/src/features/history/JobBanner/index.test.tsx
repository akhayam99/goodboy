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

  it('offers to bring the online commits into the plan when the origin moved', async () => {
    await showRun({
      phase: 'stopped',
      stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Someone pushed to the online copy');
    expect(alert.textContent).toContain('Nothing was pushed.');
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Bring them into the plan',
      'Dismiss',
    ]);
  });

  it('retries the rebase when the branch moved', async () => {
    const rebaseBranch = vi.fn(async () => 'rebased' as const);
    useAppStore.setState({ rebaseBranch });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'head-moved', message: 'moved', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry rebase' }));
    await settle();

    expect(rebaseBranch).toHaveBeenCalledWith({
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
    });
    expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  });

  it('brings the online commits into the plan from the banner', async () => {
    const bringOriginIntoHistory = vi.fn(async () => 'nothing' as const);
    useAppStore.setState({ bringOriginIntoHistory });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bring them into the plan' }));
    await settle();

    expect(bringOriginIntoHistory).toHaveBeenCalledWith({
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
    });
  });

  it('says the rebase could not be retried when it fails', async () => {
    const rebaseBranch = vi.fn(async () => {
      throw new Error('git is busy');
    });
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ rebaseBranch, reportError });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'head-moved', message: 'moved', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry rebase' }));
    await settle();

    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Couldn't retry the rebase." }),
    );
  });

  it('retries a stuck rewrite with the typed note and the same plan', async () => {
    const startHistoryRewriter = vi.fn(async () => 'rewriting' as const);
    useAppStore.setState({
      startHistoryRewriter,
      historyRewriters: {
        [A_REBASE_AGENT_ID]: {
          sessionId: A_REBASE_SESSION_ID,
          mountId: A_REBASE_MOUNT_ID,
          copyPath: '/w/payments-api-copy',
          plan: {
            worktreePath: WORKTREE,
            base: 'base-sha',
            head: 'head-sha',
            steps: [],
            onto: null,
          },
          origin: 'rebase',
          planId: null,
          identity: { worktreePath: WORKTREE, branch: MOUNT.branch, projectId: PROJECT_ID },
        },
      },
    });
    await showRun({
      phase: 'stopped',
      agentId: A_REBASE_AGENT_ID,
      stop: {
        reason: 'stuck',
        message: 'both sides change the retry key',
        files: ['webhook.ts'],
        sha: null,
      },
    });

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Retry with a note',
      'See what it did',
      'Dismiss',
    ]);
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Retry with a note' }));
    const note = screen.getByRole('textbox', { name: 'Note for History rewriter' });
    expect(note.getAttribute('placeholder')).toBe('What should it do differently?');
    fireEvent.change(note, { target: { value: 'Keep the retry key from main.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await settle();

    expect(startHistoryRewriter).toHaveBeenCalledWith({
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
      plan: { worktreePath: WORKTREE, base: 'base-sha', head: 'head-sha', steps: [], onto: null },
      origin: 'rebase',
      planId: null,
      note: 'Keep the retry key from main.',
    });
    expect(useAppStore.getState().historyRewriters[A_REBASE_AGENT_ID]).toBeUndefined();
  });

  it('collapses the note on Escape and keeps Retry off until there is a note', async () => {
    await showRun({
      phase: 'stopped',
      agentId: A_REBASE_AGENT_ID,
      stop: { reason: 'stuck', message: 'x', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry with a note' }));
    expect(screen.getByRole('button', { name: 'Retry' }).hasAttribute('disabled')).toBe(true);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Note for History rewriter' }), {
      key: 'Escape',
    });

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('retries the push from a push that failed', async () => {
    const pushHistoryRewrite = vi.fn(async () => 'pushed' as const);
    const loadHistoryDraft = vi.fn(async () => undefined);
    useAppStore.setState({ pushHistoryRewrite, loadHistoryDraft });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'push-failed', message: 'declined\nlint error', files: [], sha: null },
    });

    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Retry push',
      'Open terminal',
      'Details',
      'Dismiss',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry push' }));
    await settle();

    expect(pushHistoryRewrite).toHaveBeenCalledTimes(1);
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

    expect(screen.getByRole('dialog', { name: 'Push output' }).textContent).toContain(
      'postCredit.ts 14:7 error',
    );
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
