// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AgentId, PrCheckRun, SessionId } from '@goodboy/types';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
  type StoryStore,
} from '../../../store/storyHarness';
import { sceneInvoke, clearSceneInvoke } from '../../../test/sceneInvoke';
import { mockSceneIpc } from '../../../app/components/MockScene/scenes/mockSceneIpc';
import { analyzeFixSeed } from '../../../app/components/MockScene/scenes/u24/analyzeFixSeed';
import { checksAnalyzeSeed } from '../../../app/components/MockScene/scenes/u24/checksAnalyzeSeed';
import { BranchChecks } from './BranchChecks';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    if (command === 'gh_run') {
      return Promise.resolve({ stdout: 'Assertion failed', stderr: '', exitCode: 0 });
    }
    return sceneInvoke({ command, args });
  });
  storySpies.worktreeChangedFiles.mockResolvedValue(
    Object.assign(
      { files: [], numstat: '' },
      { paths: ['src/ledger.ts'], entries: [], additions: 0, deletions: 0 },
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

type SeedParams = {
  readonly phase: Parameters<typeof checksAnalyzeSeed>[0]['phase'];
};

type ShowParams = {
  readonly sessionId: SessionId;
  readonly name: string;
};

const showSeeded = ({ sessionId, name }: ShowParams): HTMLElement => {
  render(
    <ToastProvider>
      <BranchChecks sessionId={sessionId} />
    </ToastProvider>,
  );
  const row = document.querySelector<HTMLElement>(`[data-check-row="${name}"]`);
  if (row === null) {
    throw new Error('The failing check row is missing');
  }
  return row;
};

const show = ({ phase }: SeedParams) => {
  const seed = checksAnalyzeSeed({ phase });
  return { seed, row: showSeeded({ sessionId: seed.sessionId, name: seed.check.name }) };
};

type RerunParams = {
  readonly seed: ReturnType<typeof analyzeFixSeed>;
  readonly conclusion: PrCheckRun['conclusion'];
};

const rerunCheck = ({ seed, conclusion }: RerunParams) => {
  const rerun: PrCheckRun = {
    ...seed.check,
    conclusion,
    detailsUrl: 'https://github.com/harborline/payments-api/actions/runs/32/job/43',
  };
  store.setState((state) => {
    const mount = state.mountGithub[seed.repo.mountId];
    const session = state.sessionGithub[seed.sessionId];
    if (mount?.detail == null || session?.detail == null) {
      throw new Error('The checks scene needs the pull request detail.');
    }
    return {
      mountGithub: {
        ...state.mountGithub,
        [seed.repo.mountId]: { ...mount, detail: { ...mount.detail, checks: [rerun] } },
      },
      sessionGithub: {
        ...state.sessionGithub,
        [seed.sessionId]: { ...session, detail: { ...session.detail, checks: [rerun] } },
      },
    };
  });
};

type RowParams = {
  readonly row: HTMLElement;
};

const workStateOf = ({ row }: RowParams): string | null =>
  row.querySelector('[data-item-work]')?.getAttribute('data-item-work-state') ?? null;

const durationOf = ({ row }: RowParams): string =>
  row.querySelector('button > span:last-child')?.textContent ?? '';

type Deferred = {
  readonly promise: Promise<AgentId>;
  readonly reject: (error: Error) => void;
};

const deferredAgent = (): Deferred => {
  const handle: { reject: (error: Error) => void } = { reject: () => undefined };
  const promise = new Promise<AgentId>((_resolve, reject) => {
    handle.reject = reject;
  });
  return { promise, reject: (error) => handle.reject(error) };
};

describe('the failing check row carries its own work', () => {
  it('reads Starting on the row while Analyze is open, and a second click starts nothing', async () => {
    const pending = deferredAgent();
    const spawn = vi.spyOn(store.getState(), 'spawnAgent').mockReturnValue(pending.promise);
    const { row } = show({ phase: 'failing' });
    const analyze = within(row).getByRole('button', { name: 'Analyze' });

    fireEvent.click(analyze);
    fireEvent.click(analyze);

    await waitFor(() => expect(workStateOf({ row })).toBe('starting'));
    expect(analyze.getAttribute('aria-busy')).toBe('true');
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    fireEvent.click(analyze);
    expect(spawn).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.reject(new Error('spawn failed'));
      await pending.promise.catch(() => undefined);
    });
    await waitFor(() => expect(workStateOf({ row })).toBeNull());
    expect(within(row).getByRole('button', { name: 'Analyze' }).getAttribute('aria-busy')).toBe(
      null,
    );
  });

  it('reads Analyzing with the step under the name, hides the duration, and stops from the row', () => {
    const cancelCurrentTurn = vi
      .spyOn(store.getState(), 'cancelCurrentTurn')
      .mockResolvedValue(undefined);
    const { seed, row } = show({ phase: 'running' });

    expect(workStateOf({ row })).toBe('analyzing');
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      'Running the retry reproduction in ledger-core',
    );
    expect(durationOf({ row })).toBe('');
    expect(within(row).queryByRole('button', { name: 'Analyze' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Check fix status' })).toBeNull();

    fireEvent.click(within(row).getByRole('button', { name: 'Stop' }));
    expect(cancelCurrentTurn).toHaveBeenCalledWith(seed.sessionId, seed.agent.id, 'user');

    fireEvent.click(within(row).getByRole('button', { name: 'Open transcript' }));
    expect(store.getState().drawer).toMatchObject({
      kind: 'transcript',
      payload: { agentId: seed.agent.id },
    });
  });

  it('reads Cause found on the row once the Debugger proposed a fix', () => {
    const { row } = show({ phase: 'proposal' });

    expect(workStateOf({ row })).toBe('causeFound');
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      'The retry path does not check whether the invoice was already credited.',
    );
    expect(within(row).queryByRole('button', { name: 'Stop' })).toBeNull();
    expect(durationOf({ row })).toBe('1m 32s');
  });
});

describe('the failing check row answers with its result', () => {
  it('opens the proposal under the row with Review fix and applies it from there once', async () => {
    const pending = deferredAgent();
    const spawn = vi.spyOn(store.getState(), 'spawnAgent').mockReturnValue(pending.promise);
    const { seed, row } = show({ phase: 'proposal' });
    const review = within(row).getByRole('button', { name: 'Review fix' });
    expect(review.getAttribute('aria-expanded')).toBe('false');
    expect(within(row).queryByRole('region', { name: /Proposed fix for/ })).toBeNull();

    fireEvent.click(review);

    const proposal = within(row).getByRole('region', {
      name: `Proposed fix for ${seed.check.name}`,
    });
    expect(review.getAttribute('aria-expanded')).toBe('true');
    within(proposal).getByRole('region', { name: /Proposed diff for/ });
    const apply = within(proposal).getByRole('button', { name: 'Apply fix' });
    fireEvent.click(apply);
    fireEvent.click(apply);

    await waitFor(() => expect(workStateOf({ row })).toBe('starting'));
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      'Starting the Implementer',
    );
    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(spawn.mock.calls[0]?.[1]).toMatchObject({
      sourceCommentUrl: seed.check.detailsUrl,
    });

    await act(async () => {
      pending.reject(new Error('spawn failed'));
      await pending.promise.catch(() => undefined);
    });
    await waitFor(() => expect(workStateOf({ row })).toBe('causeFound'));
  });

  it('dismisses the proposal from under the row and offers Analyze again', () => {
    const { row } = show({ phase: 'proposal' });
    fireEvent.click(within(row).getByRole('button', { name: 'Review fix' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Dismiss' }));

    expect(workStateOf({ row })).toBe('noFixFound');
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      'You dismissed the proposal.',
    );
    within(row).getByRole('button', { name: 'Analyze again' });
  });

  it('reads No fix found with Analyze again when the Debugger proposed nothing', () => {
    const { row } = show({ phase: 'no-fix' });

    expect(workStateOf({ row })).toBe('noFixFound');
    within(row).getByRole('button', { name: 'Analyze again' });
    expect(within(row).queryByRole('button', { name: 'Review fix' })).toBeNull();
  });

  it('reads Fixed, not pushed with the commit and pushes once from the row', async () => {
    const reportError = vi.fn(async (_params: unknown) => undefined);
    store.setState({ reportError, loadSessionMounts: async () => [] });
    const seed = analyzeFixSeed({ phase: 'fixed-local' });
    const row = showSeeded({ sessionId: seed.sessionId, name: seed.check.name });

    expect(workStateOf({ row })).toBe('fixedNotPushed');
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      'Committed 9e4c1a7. Push it so the check runs again.',
    );
    mockSceneIpc((command) => {
      if (command === 'git_push') {
        return { stdout: '', stderr: 'rejected: non-fast-forward', exitCode: 1 };
      }
      if (command === 'worktree_commits') {
        return [
          {
            sha: '9e4c1a7d3b5f60718293a4b5c6d7e8f901234567',
            shortSha: '9e4c1a7',
            subject: 'Guard the retry against double credits',
            author: 'Acme Dev',
            timestamp: Math.floor(Date.now() / 1_000) + 3_600,
            pushed: false,
            parentSha: null,
          },
        ];
      }
      return null;
    });
    const push = within(row).getByRole('button', { name: 'Push' });
    fireEvent.click(push);
    fireEvent.click(push);

    await waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't push the branch" }),
      ),
    );
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(workStateOf({ row })).toBe('fixedNotPushed');
  });

  it('reads Pushed while the check runs again, with no action', () => {
    const seed = analyzeFixSeed({ phase: 'fixed-pushed' });
    const row = showSeeded({ sessionId: seed.sessionId, name: seed.check.name });

    expect(workStateOf({ row })).toBe('pushedChecking');
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      '9e4c1a7, the check runs again.',
    );
    expect(row.querySelector('[data-check-action]')?.textContent).toBe('');
  });

  it('reads Fixed on the passing run of the same check once the fix is pushed', () => {
    const seed = analyzeFixSeed({ phase: 'fixed-pushed' });
    rerunCheck({ seed, conclusion: 'success' });
    const row = showSeeded({ sessionId: seed.sessionId, name: seed.check.name });

    expect(workStateOf({ row })).toBe('fixed');
    expect(row.querySelector('[data-item-work]')?.textContent).toContain(
      '9e4c1a7 pushed, the check passed.',
    );
  });

  it('reads Failed with Retry when the fix ended without a commit, and Retry starts a new fix', async () => {
    const spawn = vi.spyOn(store.getState(), 'spawnAgent').mockReturnValue(deferredAgent().promise);
    const seed = analyzeFixSeed({ phase: 'fixing' });
    if (!('fix' in seed)) {
      throw new Error('The fixing scene needs the Implementer.');
    }
    const fixId = seed.fix.id;
    store.setState((state) => ({
      sessionPhaseRuns: {
        [seed.sessionId]: (state.sessionPhaseRuns[seed.sessionId] ?? []).map((agent) =>
          agent.id === fixId ? { ...agent, status: 'failed' as const } : agent,
        ),
      },
      agentTurnState: {
        ...state.agentTurnState,
        [fixId]: { kind: 'ended', endedAt: seed.events[0]?.at ?? '' },
      },
    }));
    const row = showSeeded({ sessionId: seed.sessionId, name: seed.check.name });

    expect(workStateOf({ row })).toBe('failed');
    expect(row.querySelector('[role="alert"]')?.textContent).toContain(
      'The fix ended without a commit.',
    );
    fireEvent.click(within(row).getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(spawn).toHaveBeenCalledTimes(1));
    expect(workStateOf({ row })).toBe('starting');
  });
});
