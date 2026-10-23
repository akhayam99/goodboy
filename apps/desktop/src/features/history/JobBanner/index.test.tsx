// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type {
  HistoryOriginAhead,
  HistoryRebasePlan,
  IsoDateTime,
  ProjectId,
  SessionEvent,
  SessionEventId,
  SessionProjectMount,
  WorktreeStatus,
} from '@goodboy/types';
import { aProject, aSession } from '@goodboy/types/testing';
import { mockSceneIpc } from '../../../app/components/MockScene/scenes/mockSceneIpc';
import { mountGithubOf } from '../../workspace/testing/sessionColumn';
import type { RebaseConflictFile } from '../../worktree/worktree';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import { useAppStore } from '../../../store';
import type { AppStore } from '../../../store/store';
import type { ProviderDisplayInfo } from '../../providers/providers';
import {
  refreshWorktreeStatuses,
  resetWorktreeStatusCache,
} from '../../../store/slices/worktreeStatuses/cache';
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

const gitNow: {
  head: string;
  behind: number;
  isRebasing: boolean;
  unmerged: number;
  upstreamAhead: number;
} = {
  head: 'head-sha',
  behind: 18,
  isRebasing: false,
  unmerged: 0,
  upstreamAhead: 0,
};

const conflictsNow: { files: ReadonlyArray<RebaseConflictFile> } = { files: [] };

const gitCalls: Array<string> = [];

const statusWith = ({ changed }: { readonly changed: number }): WorktreeStatus => ({
  branch: MOUNT.branch,
  head: gitNow.head,
  headSubject: 'Guard the settlement batch',
  upstream: `origin/${MOUNT.branch}`,
  upstreamDistance: { kind: 'known', ahead: gitNow.upstreamAhead, behind: 0 },
  mainDistance: { kind: 'known', ahead: 7, behind: gitNow.behind },
  workingTree: {
    kind: 'known',
    staged: changed,
    unstaged: 0,
    untracked: 0,
    unmerged: gitNow.unmerged,
    changed,
  },
  inProgress: gitNow.isRebasing ? 'rebase' : null,
});

const dirty = { changed: 11 };

const REBASE_PLAN: HistoryRebasePlan = {
  onto: 'c0ffee000000',
  ontoRef: 'origin/main',
  mergeBase: 'a0a0a0a0a0a0',
  head: 'head-sha',
  commits: [],
  behind: 18,
  fetchError: null,
};

const ORIGIN_AHEAD: HistoryOriginAhead = {
  remoteSha: 'online-sha',
  knownRemoteSha: 'old-online-sha',
  commits: [{ sha: '7c41e0a9b8c7', subject: 'Fix the avatar size on narrow screens' }],
  onlyOnline: [{ sha: '7c41e0a9b8c7', subject: 'Fix the avatar size on narrow screens' }],
  fetchError: null,
};

const CONNECTED: ReadonlyArray<ProviderDisplayInfo> = [
  {
    id: 'anthropic',
    binary: 'claude',
    capabilities: {
      models: [],
      supportsTools: true,
      supportsStream: true,
      supportsCheapModel: true,
    },
    connection: 'connected',
    version: '1.0.0',
    identity: 'harborline',
    label: 'Claude',
    error: null,
    docsUrl: 'https://example.invalid/docs',
  },
];

type SavedStopParams = {
  readonly at: string;
};

const savedConflict = ({ at }: SavedStopParams): SessionEvent => ({
  id: brandedId<SessionEventId>({ value: 'ev-stop' }),
  sessionId: A_REBASE_SESSION_ID,
  kind: 'history_stopped',
  payload: {
    mountId: A_REBASE_MOUNT_ID,
    branch: MOUNT.branch,
    projectName: 'payments-api',
    origin: 'rebase',
    reason: 'conflict',
    title: '2 files conflict with main.',
    files: ['src/settlement/batch.ts', 'src/settlement/ledger.ts'],
    head: 'head-sha',
  },
  createdAt: brandedId<IsoDateTime>({ value: at }),
});

const PAST = '2026-10-01T10:00:00.000Z';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  dirty.changed = 0;
  gitNow.head = 'head-sha';
  gitNow.behind = 18;
  gitNow.isRebasing = false;
  gitNow.unmerged = 0;
  gitNow.upstreamAhead = 0;
  conflictsNow.files = [];
  gitCalls.length = 0;
  mockSceneIpc((command) => {
    if (command === 'worktree_rebase_conflicts') {
      return conflictsNow.files;
    }
    if (command === 'worktree_start_rebase') {
      gitCalls.push(command);
      gitNow.isRebasing = true;
      gitNow.unmerged = 2;
      return { isInProgress: true };
    }
    if (command === 'worktree_continue_rebase') {
      gitCalls.push(command);
      gitNow.isRebasing = false;
      gitNow.unmerged = 0;
      gitNow.behind = 0;
      gitNow.head = 'rebased-sha';
      return { isInProgress: false };
    }
    if (command === 'history_rebase_plan') {
      return REBASE_PLAN;
    }
    if (command === 'history_origin_ahead') {
      return ORIGIN_AHEAD;
    }
    return command === 'worktree_status' ? statusWith({ changed: dirty.changed }) : null;
  });
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

type NodeParams = {
  readonly node: HTMLElement;
};

const verbsIn = ({ node }: NodeParams): ReadonlyArray<string> =>
  Array.from(node.querySelectorAll('[data-rebase-verb]')).map((verb) => verb.textContent ?? '');

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
    'leaves a run in its %j phase to the worktree status line, no card on the page',
    async (patch, title, line) => {
      await showRun(patch);

      expect(screen.queryByRole('region', { name: 'Rebase job' })).toBeNull();
      expect(screen.queryByText(title)).toBeNull();
      expect(screen.queryByText(line)).toBeNull();
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

  it('names the new online commit and offers Bring them in, Resolve myself and Undo rebase', async () => {
    await showRun({
      phase: 'stopped',
      backupRef: 'refs/goodboy/backup/1',
      stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
    });

    const panel = screen.getByRole('region', { name: 'Rebase' });
    expect(panel.textContent).toContain('Rebased here, but origin has 1 new commit');
    expect(panel.textContent).toContain('Fix the avatar size on narrow screens');
    expect(verbsIn({ node: panel })).toEqual(['Bring them in', 'Resolve myself', 'Undo rebase']);
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

  it('brings the online commits in, then pushes with the lease of what it brought in', async () => {
    const pushHistoryRewrite = vi.fn<AppStore['pushHistoryRewrite']>(async () => 'pushed');
    const bringOriginIntoHistory = vi.fn<AppStore['bringOriginIntoHistory']>(async () => {
      useAppStore.setState((state) => ({
        historyRuns: {
          ...state.historyRuns,
          [A_REBASE_MOUNT_ID]: aRebaseRun({ phase: 'applied', remoteSha: 'online-sha' }),
        },
      }));
      return 'applied';
    });
    useAppStore.setState({ bringOriginIntoHistory, pushHistoryRewrite });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'origin-moved', message: 'Origin moved.', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Bring them in' }));
    await settle();

    expect(bringOriginIntoHistory).toHaveBeenCalledWith({
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
      canStartRewriter: true,
    });
    expect(pushHistoryRewrite).toHaveBeenCalledWith(
      expect.objectContaining({ mountId: A_REBASE_MOUNT_ID, expectedRemoteSha: 'online-sha' }),
    );
  });

  it('keeps the panel with the error when a verb fails, and Retry runs it again', async () => {
    const rebaseBranch = vi
      .fn<AppStore['rebaseBranch']>()
      .mockRejectedValueOnce(new Error('git is busy'))
      .mockResolvedValueOnce('rebased');
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ rebaseBranch, reportError });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'head-moved', message: 'moved', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry rebase' }));
    await settle();

    const panel = screen.getByRole('region', { name: 'Rebase' });
    expect(within(panel).getByText('git is busy')).toBeDefined();
    expect(reportError).not.toHaveBeenCalled();

    fireEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
    await settle();

    expect(rebaseBranch).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('git is busy')).toBeNull();
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

    expect(verbsIn({ node: screen.getByRole('region', { name: 'Rebase' }) })).toEqual([
      'Fix with agent',
      'Open terminal here',
      'Retry push',
    ]);
    expect(screen.getByRole('button', { name: 'Details' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry push' }));
    await settle();

    expect(pushHistoryRewrite).toHaveBeenCalledTimes(1);
  });

  it('hands a failed push to an agent', async () => {
    const fixPushWithAgent = vi.fn(async () => undefined);
    useAppStore.setState({ fixPushWithAgent });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'push-failed', message: 'declined\nlint error', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Fix with agent' }));
    await settle();

    expect(fixPushWithAgent).toHaveBeenCalledTimes(1);
  });

  it('hands the hint of a failed push to the agent and keeps it after Escape', async () => {
    const fixPushWithAgent = vi.fn(async () => undefined);
    useAppStore.setState({ fixPushWithAgent });
    await showRun({
      phase: 'stopped',
      stop: { reason: 'push-failed', message: 'declined\nlint error', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a hint' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Hint for the Implementer' }), {
      target: { value: '  Keep the lint rule.  ' },
    });
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('textbox', { name: 'Hint for the Implementer' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fix with agent' }));
    await settle();

    expect(fixPushWithAgent).toHaveBeenCalledWith(
      expect.objectContaining({ hint: 'Keep the lint rule.', onAccepted: expect.any(Function) }),
    );
  });

  it('opens the terminal with the exact lease push typed, not run', async () => {
    await showRun({
      phase: 'stopped',
      remoteSha: 'a1b2c3d',
      stop: { reason: 'push-failed', message: 'declined\nlint error', files: [], sha: null },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open terminal here' }));

    const tabs = useAppStore.getState().terminalTabs[A_REBASE_SESSION_ID] ?? [];
    expect(tabs[0]?.prefill).toBe(
      "git push --force-with-lease='hl/fix-duplicate-credit:a1b2c3d' origin 'hl/fix-duplicate-credit'",
    );
    expect(useAppStore.getState().drawer?.kind).toBe('terminal');
  });

  it('shows the agent working and drops the failure actions', async () => {
    await showRun({
      phase: 'stopped',
      stop: { reason: 'push-failed', message: 'declined\nlint error', files: [], sha: null },
      pushFix: { agentId: A_REBASE_AGENT_ID },
    });

    expect(screen.queryByRole('button', { name: 'Fix with agent' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry push' })).toBeNull();
    expect(screen.getByRole('button', { name: 'See what it did' })).toBeDefined();
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

    expect(screen.getByRole('alert').textContent).toContain('pre-push hook declined');
    expect(screen.queryByText(/postCredit\.ts 14:7 error/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Details' }));

    expect(screen.getByRole('dialog', { name: 'Push output' }).textContent).toContain(
      'postCredit.ts 14:7 error',
    );
    expect(screen.getByRole('button', { name: 'Open terminal here' })).toBeDefined();
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

  it.each(['head-moved', 'blocked'] as const)(
    'offers Retry rebase and no Dismiss on a %s stop, which blocks the branch',
    async (reason) => {
      await showRun({
        phase: 'stopped',
        stop: { reason, message: 'moved', files: [], sha: null },
      });

      expect(verbsIn({ node: screen.getByRole('region', { name: 'Rebase' }) })).toEqual([
        'Retry rebase',
        'Open terminal',
      ]);
    },
  );

  it.each([
    ['failed', 'the rebase failed'],
    ['unverified', 'changed ledger.ts'],
  ] as const)(
    'dismisses a %s stop by recording it, so it leaves Next too',
    async (reason, message) => {
      await showRun({ phase: 'stopped', stop: { reason, message, files: [], sha: null } });

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
      await settle();

      expect(useAppStore.getState().historyRuns[A_REBASE_MOUNT_ID]).toBeUndefined();
      expect(screen.queryByRole('region', { name: 'Rebase' })).toBeNull();
    },
  );
});

describe('a dirty tree stop', () => {
  const dirtyStop = { reason: 'dirty', message: 'unused', files: [], sha: null } as const;

  it('names the files, offers Retry rebase, and leaves when the tree is clean again', async () => {
    dirty.changed = 11;
    await showRun({ phase: 'stopped', stop: dirtyStop });

    expect(screen.getByRole('alert').textContent).toContain(
      '11 files have changes that are not committed',
    );
    expect(verbsIn({ node: screen.getByRole('region', { name: 'Rebase' }) })).toEqual([
      'Retry rebase',
      'Open terminal',
    ]);

    dirty.changed = 0;
    await act(async () => {
      await refreshWorktreeStatuses({ worktreePaths: [WORKTREE] });
    });
    await settle();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Rebase' })).toBeNull();
  });
});

describe('a stop saved before a restart', () => {
  const showSaved = async ({ at }: SavedStopParams) => {
    useAppStore.setState({
      historyRuns: {},
      sessionEvents: { [A_REBASE_SESSION_ID]: [savedConflict({ at })] },
    });
    render(<JobBanner sessionId={A_REBASE_SESSION_ID} worktreePath={WORKTREE} />);
    await settle();
  };

  it('asks with the same prompt and verbs as the window that ran the rebase', async () => {
    await showRun({
      phase: 'stopped',
      stop: {
        reason: 'conflict',
        message: '2 files conflict with main.',
        files: ['src/settlement/batch.ts', 'src/settlement/ledger.ts'],
        sha: null,
        head: 'head-sha',
      },
      rebaseConflict: {
        ontoRef: 'origin/main',
        baseBranch: 'main',
        head: 'head-sha',
        autoAgentId: null,
      },
    });
    const live = screen.getByRole('alert');
    const liveTitle = live.textContent;
    const liveVerbs = verbsIn({ node: live });
    cleanup();

    await showSaved({ at: PAST });

    const saved = screen.getByRole('alert');
    expect(saved.textContent).toBe(liveTitle);
    expect(verbsIn({ node: saved })).toEqual(liveVerbs);
    expect(liveVerbs).toEqual(['Resolve with Auto', 'Resolve myself', 'Keep branch as it was']);
  });

  it('starts Auto from the saved stop and then says Auto has it', async () => {
    const spawnAgent = vi.fn<AppStore['spawnAgent']>(async (_sessionId, args) => {
      args.onKickoffAccepted?.();
      return A_REBASE_AGENT_ID;
    });
    useAppStore.setState({ providers: CONNECTED, spawnAgent });
    await showSaved({ at: PAST });

    fireEvent.click(screen.getByRole('button', { name: 'Resolve with Auto' }));
    await settle();

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(spawnAgent.mock.calls[0]?.[1].initialPrompt).toContain('rebase on origin/main');
    expect(useAppStore.getState().historyRuns[A_REBASE_MOUNT_ID]?.rebaseConflict?.autoAgentId).toBe(
      A_REBASE_AGENT_ID,
    );
    expect(screen.getByText('Auto is rebasing on main')).toBeDefined();
  });

  it('leaves once a fresh git read shows the rebase finished', async () => {
    gitNow.head = 'moved-sha';
    gitNow.behind = 0;

    await showSaved({ at: PAST });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('drops a late git read for an old head that was requested before the stop', async () => {
    gitNow.head = 'moved-sha';
    gitNow.behind = 0;

    await showSaved({ at: new Date(Date.now() + 60_000).toISOString() });

    expect(screen.getByRole('alert').textContent).toContain(
      'Rebase on main stopped: 2 files conflict',
    );
  });
});

describe('the rebase stop panel', () => {
  const CONFLICT_STOP = {
    reason: 'conflict',
    message: '2 files conflict with main.',
    files: ['src/settlement/batch.ts', 'src/settlement/ledger.ts'],
    sha: null,
    head: 'head-sha',
  } as const;

  const conflictRun = (patch: Partial<HistoryRun> = {}): Partial<HistoryRun> => ({
    phase: 'stopped',
    commitCount: 4,
    stop: CONFLICT_STOP,
    rebaseConflict: {
      ontoRef: 'origin/main',
      baseBranch: 'main',
      head: 'head-sha',
      autoAgentId: null,
    },
    ...patch,
  });

  const panel = (): HTMLElement => screen.getByRole('region', { name: 'Rebase' });

  const fileStates = (): ReadonlyArray<string | null> =>
    Array.from(panel().querySelectorAll('[data-rebase-file]')).map((node) =>
      node.getAttribute('data-rebase-file'),
    );

  const refresh = async (): Promise<void> => {
    await act(async () => {
      await refreshWorktreeStatuses({ worktreePaths: [WORKTREE] });
    });
    await settle();
  };

  it('names what stopped, lists every file, and offers the three ways forward', async () => {
    await showRun(conflictRun());

    expect(panel().textContent).toContain('Rebase on main stopped: 2 files conflict');
    expect(panel().textContent).toContain('Your branch is as it was.');
    expect(within(panel()).getByText('src/settlement/batch.ts')).toBeDefined();
    expect(within(panel()).getByText('src/settlement/ledger.ts')).toBeDefined();
    expect(fileStates()).toEqual(['conflict', 'conflict']);
    expect(verbsIn({ node: panel() })).toEqual([
      'Resolve with Auto',
      'Resolve myself',
      'Keep branch as it was',
    ]);
    expect(
      within(panel()).getByRole('button', { name: 'Resolve with Auto' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('starts the rebase in the worktree on Resolve myself, then holds Continue until no file conflicts', async () => {
    await showRun(conflictRun());

    conflictsNow.files = [
      { path: 'src/settlement/batch.ts', hasMarkers: true, isStageOnly: false },
      { path: 'src/settlement/ledger.ts', hasMarkers: true, isStageOnly: false },
    ];
    fireEvent.click(screen.getByRole('button', { name: 'Resolve myself' }));
    await settle();

    expect(gitCalls).toEqual(['worktree_start_rebase']);
    expect(useAppStore.getState().historyRuns[A_REBASE_MOUNT_ID]?.rebaseConflict?.isHere).toBe(
      true,
    );
    expect((useAppStore.getState().terminalTabs[A_REBASE_SESSION_ID] ?? []).length).toBe(1);
    expect(panel().textContent).toContain('You are rebasing on main in the terminal');
    expect(panel().textContent).toContain('2 of 2 files left.');
    expect(verbsIn({ node: panel() })).toEqual([
      'Continue rebase',
      'Open terminal',
      'Abort rebase',
    ]);
    const blocked = within(panel()).getByRole('button', { name: 'Continue rebase' });
    expect(blocked.hasAttribute('disabled')).toBe(true);

    conflictsNow.files = [
      { path: 'src/settlement/batch.ts', hasMarkers: false, isStageOnly: false },
      { path: 'src/settlement/ledger.ts', hasMarkers: true, isStageOnly: false },
    ];
    gitNow.unmerged = 1;
    await refresh();
    expect(panel().textContent).toContain('1 of 2 files left.');
    expect(fileStates()).toEqual(['resolved', 'conflict']);
    expect(
      within(panel()).getByRole('button', { name: 'Continue rebase' }).hasAttribute('disabled'),
    ).toBe(true);

    conflictsNow.files = [
      { path: 'src/settlement/batch.ts', hasMarkers: false, isStageOnly: false },
      { path: 'src/settlement/ledger.ts', hasMarkers: false, isStageOnly: false },
    ];
    gitNow.unmerged = 0;
    await refresh();
    const ready = within(panel()).getByRole('button', { name: 'Continue rebase' });
    expect(ready.hasAttribute('disabled')).toBe(false);

    gitNow.upstreamAhead = 4;
    fireEvent.click(ready);
    await settle();

    expect(gitCalls).toEqual(['worktree_start_rebase', 'worktree_continue_rebase']);
    expect(panel().textContent).toContain('Rebased on main');
    expect(panel().textContent).toContain('Origin still has the old copy.');
  });

  it('keeps a markerless conflict unresolved until it is staged, with Continue off', async () => {
    await showRun(conflictRun());

    conflictsNow.files = [
      { path: 'src/settlement/batch.ts', hasMarkers: false, isStageOnly: true },
      { path: 'src/settlement/ledger.ts', hasMarkers: true, isStageOnly: false },
    ];
    fireEvent.click(screen.getByRole('button', { name: 'Resolve myself' }));
    await settle();

    expect(fileStates()).toEqual(['conflict', 'conflict']);
    expect(panel().textContent).toContain('stage it with git add or git rm');

    conflictsNow.files = [
      { path: 'src/settlement/batch.ts', hasMarkers: false, isStageOnly: true },
      { path: 'src/settlement/ledger.ts', hasMarkers: false, isStageOnly: false },
    ];
    gitNow.unmerged = 1;
    await refresh();
    expect(fileStates()).toEqual(['conflict', 'resolved']);
    expect(
      within(panel()).getByRole('button', { name: 'Continue rebase' }).hasAttribute('disabled'),
    ).toBe(true);

    conflictsNow.files = [
      { path: 'src/settlement/ledger.ts', hasMarkers: false, isStageOnly: false },
    ];
    gitNow.unmerged = 0;
    await refresh();
    expect(fileStates()).toEqual(['resolved', 'resolved']);
    expect(
      within(panel()).getByRole('button', { name: 'Continue rebase' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('keeps the branch as it was and records it', async () => {
    const keepRebaseStop = vi.fn<AppStore['keepRebaseStop']>(async () => undefined);
    useAppStore.setState({ keepRebaseStop });
    await showRun(conflictRun());

    fireEvent.click(screen.getByRole('button', { name: 'Keep branch as it was' }));
    await settle();

    expect(keepRebaseStop).toHaveBeenCalledWith({
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
    });
  });

  it('shows Auto at work with the files it resolves and Open Auto only', async () => {
    gitNow.isRebasing = true;
    gitNow.unmerged = 1;
    conflictsNow.files = [
      { path: 'src/settlement/ledger.ts', hasMarkers: true, isStageOnly: false },
    ];
    await showRun(
      conflictRun({
        rebaseConflict: {
          ontoRef: 'origin/main',
          baseBranch: 'main',
          head: 'head-sha',
          autoAgentId: A_REBASE_AGENT_ID,
        },
      }),
    );

    expect(panel().textContent).toContain('Auto is rebasing on main');
    expect(panel().textContent).toContain('1 of 2 files resolved.');
    expect(fileStates()).toEqual(['resolved', 'conflict']);
    expect(verbsIn({ node: panel() })).toEqual(['Open Auto']);
  });

  it('offers Push with the lease once Auto rebased, and says pushed once origin has it', async () => {
    gitNow.behind = 0;
    gitNow.upstreamAhead = 4;
    useAppStore.setState({
      mountGithub: { [A_REBASE_MOUNT_ID]: mountGithubOf({ mount: MOUNT, number: 418 }) },
    });
    await showRun(
      conflictRun({
        rebaseConflict: {
          ontoRef: 'origin/main',
          baseBranch: 'main',
          head: 'head-sha',
          autoAgentId: A_REBASE_AGENT_ID,
        },
      }),
    );

    expect(panel().textContent).toContain('Rebased on main');
    expect(verbsIn({ node: panel() })).toEqual(['Push', 'See what Auto did']);

    gitNow.upstreamAhead = 0;
    await refresh();

    expect(panel().textContent).toContain('Pushed to origin');
    expect(verbsIn({ node: panel() })).toEqual(['Dismiss']);
  });

  it('offers a plain Push on a branch with no pull request', async () => {
    const pushSessionBranch = vi.fn<AppStore['pushSessionBranch']>(async () => ({ ok: true }));
    useAppStore.setState({ pushSessionBranch });
    gitNow.behind = 0;
    gitNow.upstreamAhead = 4;
    await showRun(
      conflictRun({
        rebaseConflict: {
          ontoRef: 'origin/main',
          baseBranch: 'main',
          head: 'head-sha',
          autoAgentId: A_REBASE_AGENT_ID,
        },
      }),
    );

    expect(verbsIn({ node: panel() })).toEqual(['Push', 'See what Auto did']);

    fireEvent.click(within(panel()).getByRole('button', { name: 'Push' }));
    await settle();

    expect(pushSessionBranch).toHaveBeenCalledWith({
      sessionId: A_REBASE_SESSION_ID,
      mountId: A_REBASE_MOUNT_ID,
    });
  });

  it('keeps the panel with the error when the plain push fails', async () => {
    const pushSessionBranch = vi.fn<AppStore['pushSessionBranch']>(async () => ({
      ok: false,
      error: 'rejected: non-fast-forward',
    }));
    useAppStore.setState({ pushSessionBranch });
    gitNow.behind = 0;
    gitNow.upstreamAhead = 4;
    await showRun(
      conflictRun({
        rebaseConflict: {
          ontoRef: 'origin/main',
          baseBranch: 'main',
          head: 'head-sha',
          autoAgentId: A_REBASE_AGENT_ID,
        },
      }),
    );

    fireEvent.click(within(panel()).getByRole('button', { name: 'Push' }));
    await settle();

    expect(panel().textContent).toContain('rejected: non-fast-forward');
    fireEvent.click(within(panel()).getByRole('button', { name: 'Retry' }));
    await settle();

    expect(pushSessionBranch).toHaveBeenCalledTimes(2);
  });
});
