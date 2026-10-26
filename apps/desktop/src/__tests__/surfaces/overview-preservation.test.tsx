// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () => {
  const { sceneInvoke } = await import('../../test/sceneInvoke');
  return { invoke: vi.fn((command: string, args?: unknown) => sceneInvoke({ command, args })) };
});
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../shared/components/Toast';
import { installFakeResizeObserver } from '../../test/fakeResizeObserver';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../store/storyHarness';
import type { StoryStore } from '../../store/storyHarness';
import { resetWorktreeStatusCache } from '../../store/runtime/worktreeStatuses/cache';
import { clearSceneInvoke } from '../../test/sceneInvoke';
import { MOCK_SCENES } from '../../app/components/MockScene';
import { collectAskPackInput } from '../../features/session/ask/collectAskPackInput';
import { seriesStripsOf } from '../../store/slices/pr-series/seriesStripsOf';
import { MountsScene } from '../../app/components/MockScene/scenes/MountsScene';

const SETTLE_MS = 2_000;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  installFakeResizeObserver();
  await resetStoryStore();
  resetWorktreeStatusCache();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  clearSceneInvoke();
});

const advance = async (): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SETTLE_MS);
  });
};

type SceneParams = {
  readonly name: string;
};

const mountScene = async ({ name }: SceneParams): Promise<void> => {
  const Scene = MOCK_SCENES[name];
  if (Scene === undefined) {
    throw new Error(`${name} is not a registered scene`);
  }
  render(
    <ToastProvider>
      <Scene />
    </ToastProvider>,
  );
  await advance();
};

const header = () => {
  const node = document.querySelector<HTMLElement>('[data-slot="pane-header"]');
  if (node === null) {
    throw new Error('no Overview header');
  }
  return within(node);
};

type PresentParams = {
  readonly value: HTMLElement | null | undefined;
  readonly what: string;
};

const present = ({ value, what }: PresentParams): HTMLElement => {
  if (value === null || value === undefined) {
    throw new Error(`no ${what}`);
  }
  return value;
};

const notices = () => within(screen.getByRole('region', { name: 'Notices' }));

describe('Overview capabilities from the session Overview', () => {
  it('shows the goal as prose and opens it in the Context drawer', async () => {
    await mountScene({ name: 'c05-overview-merged-next' });

    expect(screen.queryByRole('button', { name: /^Goal: Split the ledger/ })).toBeNull();
    const sessionId = Object.keys(useAppStore.getState().sessionSlots)[0] ?? '';
    act(() => {
      useAppStore.setState((state) => ({
        sessionSlots: {
          ...state.sessionSlots,
          [sessionId]: [
            {
              key: 'goal',
              value: 'Reviewers read the ledger rewrite one part at a time.',
              enabled: true,
            },
          ],
        },
      }));
    });
    fireEvent.click(screen.getByRole('button', { name: /^Goal: Reviewers read the ledger/ }));
    await advance();

    expect(useAppStore.getState().drawer?.kind).toBe('context');
  });

  it('offers Add a goal and the quiet start on a blank session', async () => {
    await mountScene({ name: 'c05-overview-blank' });

    screen.getByRole('button', { name: 'Add a goal' });
    header().getByRole('button', { name: 'New' });
  });

  it('keeps the chat provenance line under the goal', async () => {
    await mountScene({ name: 'overview-header-provenance' });

    screen.getByRole('button', { name: /From chat: Payments retry design/ });
  });

  it('keeps Write title and goal from linked work in the Context pane, opened from the session tools', async () => {
    await mountScene({ name: 'c05-overview-merged-next' });

    expect(
      header().queryByRole('button', { name: 'Write title and goal from linked work' }),
    ).toBeNull();
    fireEvent.click(
      within(screen.getByRole('toolbar', { name: 'Session tools' })).getByRole('button', {
        name: /^Context/,
      }),
    );
    await advance();

    await advance();
    const action = screen.getByRole('button', { name: 'Write title and goal from linked work' });
    expect(action.getAttribute('data-variant')).toBe('secondary');
    expect(action.querySelector('svg')).not.toBeNull();
  });

  it('turns a mount cleanup proposal into a Next row with Remove worktree and an undoable Not now', async () => {
    await mountScene({ name: 'c05-overview-merged-next' });
    const next = screen.getByRole('region', { name: 'Next' });
    for (const fold of next.querySelectorAll<HTMLElement>('button[aria-expanded="false"]')) {
      fireEvent.click(fold);
    }
    const row =
      Array.from(next.querySelectorAll<HTMLElement>('[data-action-card]')).find((candidate) =>
        (candidate.textContent ?? '').includes('Remove the ledger-core worktree'),
      ) ?? null;
    const card = within(present({ value: row, what: 'the cleanup row' }));
    card.getByRole('button', { name: 'Remove worktree' });

    fireEvent.click(
      card.getByRole('button', { name: 'More options for Remove the ledger-core worktree' }),
    );
    await advance();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Not now' }));
    await advance();

    expect(screen.queryByText('Remove the ledger-core worktree')).toBeNull();
    screen.getByText('Dismissed');
  });

  it('keeps the branch drift decision in the notices slot', async () => {
    await mountScene({ name: 'c05-overview-notices' });

    notices().getByRole('button', { name: 'Use this branch here' });
    notices().getByRole('button', { name: 'Keep both branches' });
  });

  it('keeps Restore branch and Remove for a deleted branch in the notices slot', async () => {
    await mountScene({ name: 'c05-overview-notices' });

    notices().getByRole('button', { name: /^Restore branch for/ });
    notices().getByRole('button', { name: /^Remove for/ });
  });

  it('keeps Reopen on a closed worktree and a failed Reopen raises a notice with Retry', async () => {
    render(
      <ToastProvider>
        <MountsScene variant="closed-rows" />
      </ToastProvider>,
    );
    await advance();
    const attempts: Array<string> = [];
    useAppStore.setState({
      attachMount: async ({ mountId }) => {
        attempts.push(mountId);
        throw new Error('fatal: the worktree path is already registered by another process');
      },
    });

    fireEvent.click(
      present({
        value: notices().getAllByRole('button', { name: /^Reopen for/ })[0],
        what: 'Reopen',
      }),
    );
    await advance();

    const alert = notices().getByRole('alert');
    expect(alert.textContent).toMatch(/^Couldn't reopen /);
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await advance();
    expect(attempts).toHaveLength(2);
  });

  it('keeps the first lap Publish on the Overview', async () => {
    await mountScene({ name: 'frame-first-lap-notice' });

    expect(screen.getAllByRole('button', { name: 'Publish' }).length).toBeGreaterThan(0);
  });

  it('keeps the unassigned notes on the Overview', async () => {
    render(
      <ToastProvider>
        <MountsScene variant="unassigned-notes" />
      </ToastProvider>,
    );
    await advance();

    screen.getByRole('region', { name: 'Unassigned notes' });
  });

  it('leaves the detached mount out of the Ask context and the worktree list', async () => {
    render(
      <ToastProvider>
        <MountsScene />
      </ToastProvider>,
    );
    await advance();
    const state = useAppStore.getState();
    const sessionId = state.currentSessionId;
    if (sessionId === null) {
      throw new Error('no current session');
    }

    const pack = collectAskPackInput({ state, sessionId, rightNow: [] });
    const branches = pack.branches.map((entry) => entry.branch);

    expect(branches).toContain('fix/ledger-reconciliation-idempotent-postings');
    expect(branches).not.toContain('fix/ledger-reconciliation-settlement-boundaries');
    expect(branches).not.toContain('fix/ledger-reconciliation-statement-backfill');
    expect(
      (state.sessionWorktreeRecords?.[sessionId] ?? []).map((record) => record.branch),
    ).not.toContain('fix/ledger-reconciliation-settlement-boundaries');
    expect(state.sessionWorktrees[sessionId]).not.toContain(
      '~/code/harborline/ledger-core-boundaries',
    );
  });

  it('reads the merged parts of the series strip from mounts the loader keeps', async () => {
    render(
      <ToastProvider>
        <MountsScene />
      </ToastProvider>,
    );
    await advance();
    const state = useAppStore.getState();
    const sessionId = state.currentSessionId;
    if (sessionId === null) {
      throw new Error('no current session');
    }

    const [strip] = seriesStripsOf({ state, sessionId });

    expect(strip?.parts.map((part) => part.state)).toEqual([
      'merged',
      'merged',
      'open',
      'open',
      'open',
      'planned',
    ]);
  });

  it('keeps the exact ask one press away: Answer on the run row opens the question beside the page', async () => {
    await mountScene({ name: 'c05-overview-running' });

    const running = screen.getByRole('region', { name: 'Running' });
    fireEvent.click(within(running).getByRole('button', { name: 'Answer' }));
    await advance();

    expect(useAppStore.getState().drawer?.kind).toBe('question');
    expect(document.querySelector('[data-page="overview"]')).not.toBeNull();
  });

  it('keeps the full log with its search, the session spend moved to the rail foot', async () => {
    await mountScene({ name: 'c05-overview-running' });
    const sessionId = useAppStore.getState().currentSessionId;
    const column = document.querySelector<HTMLElement>('[data-central-column]');
    expect(
      within(present({ value: column, what: 'the cards' })).queryByRole('button', {
        name: /^Spend /,
      }),
    ).toBeNull();
    act(() => {
      if (sessionId === null) {
        throw new Error('the scene has no current session');
      }
      useAppStore.getState().openDrawer({
        kind: 'session-log',
        sessionId,
        payload: { focusEntryId: null },
      });
    });
    await advance();

    within(screen.getByRole('region', { name: 'Log entries' })).getByRole('searchbox', {
      name: 'Search the log',
    });
  });

  it('keeps an archived session read only with Restore', async () => {
    await mountScene({ name: 'c05-overview-archived' });

    header().getByRole('button', { name: /Restore/ });
    expect(header().queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Next steps' })).toBeNull();
  });

  it('keeps the move of a task onto a branch by drag, now onto a worktree row of the sidebar', async () => {
    await mountScene({ name: 'taskdrag-overbranch' });

    const aimed = document.querySelector('[data-scene-aim]');
    expect(aimed?.getAttribute('data-task-drop')).toBe('branch');
    expect(aimed?.closest('[data-level-layer="session"]')).not.toBeNull();
  });
});
