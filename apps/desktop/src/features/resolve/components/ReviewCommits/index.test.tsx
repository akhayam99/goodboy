// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  MOUNT_TARGET,
  PROJECT_ID,
  SESSION,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { reviewDraftSignature } from '../../reviewCommits';
import { seedResolveCommitsScene } from '../../../../app/components/MockScene/scenes/resolveCommitsSeed';
import { ReviewFlow } from '../ReviewFlow';

type StoreState = ReturnType<StoryStore['getState']>;

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const settle = async (ms = 20): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

const mount = async (): Promise<void> => {
  seedResolveCommitsScene();
  render(
    <ToastProvider>
      <ReviewFlow session={SESSION} />
    </ToastProvider>,
  );
  await settle();
};

const openCommits = async (): Promise<void> => {
  fireEvent.click(screen.getByRole('tab', { name: /^Commits/ }));
  await settle();
};

const commitList = (): HTMLElement => screen.getByRole('list', { name: 'Branch commits' });

describe('Review commits view', () => {
  it('switches views with V and lists the branch commits oldest first', async () => {
    await mount();
    fireEvent.keyDown(screen.getByRole('tab', { name: /^Comments/ }), { key: 'v', code: 'KeyV' });
    await settle();

    const rows = within(commitList()).getAllByRole('listitem');
    expect(rows.map((row) => row.getAttribute('data-sha')?.slice(0, 7))).toEqual([
      '3f9a2c1',
      '7be41d0',
      'c81e5aa',
      '9f2c1ab',
      'd4e7b20',
    ]);
    expect(within(commitList()).getByText('for kenji-w on retryPolicy.ts:42')).toBeDefined();
  });

  it('previews Fold each, says it is a force push with lease, and remembers the preset', async () => {
    await mount();
    await openCommits();

    fireEvent.click(screen.getByRole('tab', { name: 'Fold each into its original' }));
    await settle();

    expect(screen.getByText('2 commits')).toBeDefined();
    expect(screen.getByText(/force push with a lease/)).toBeDefined();
    expect(screen.getByRole('button', { name: /Rewrite and push/ })).toBeDefined();
    expect(useAppStore.getState().reviewCommitPresets[PROJECT_ID]).toBe('fold');
  });

  it('shows the reply each resolve commit will carry once the shas move', async () => {
    await mount();
    await openCommits();
    expect(screen.queryByRole('region', { name: 'Replies' })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Fold each into its original' }));
    await settle();

    const replies = screen.getByRole('region', { name: 'Replies' });
    expect(within(replies).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(replies).getByText('for kenji-w on retryPolicy.ts:42')).toBeDefined();
  });

  it('rewrites through the history engine with a push, then undoes from the backup', async () => {
    await mount();
    const seeded = useAppStore.getState();
    const apply = vi.fn(seeded.applyHistoryDraft);
    const restore = vi.fn(seeded.restoreHistory);
    useAppStore.setState({
      applyHistoryDraft: apply as StoreState['applyHistoryDraft'],
      restoreHistory: restore as StoreState['restoreHistory'],
    });
    await openCommits();
    fireEvent.click(screen.getByRole('tab', { name: 'Fold each into its original' }));
    await settle();

    fireEvent.click(screen.getByRole('button', { name: /Rewrite and push/ }));
    await waitFor(() => expect(screen.getByText('Branch rewritten.')).toBeDefined(), {
      timeout: 8000,
    });
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ shouldPush: true }));
    expect(screen.getByText('Pushed with a lease')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect(restore).toHaveBeenCalledWith(
      expect.objectContaining({ backupRef: 'refs/goodboy/backup/318-1042', shouldPush: true }),
    );
  }, 20_000);

  it('opens the comment a resolve commit was made for', async () => {
    await mount();
    await openCommits();

    fireEvent.click(within(commitList()).getByText('for kenji-w on retryPolicy.ts:42'));
    await settle();

    expect(screen.queryByRole('list', { name: 'Branch commits' })).toBeNull();
    expect(screen.getByRole('tab', { name: /^Comments/ }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });
});

const MOUNT_ID = MOUNT_TARGET.mountId;

const planDraft = (): void => {
  const state = useAppStore.getState();
  const draft = state.historyDrafts[MOUNT_ID];
  if (draft === undefined) {
    throw new Error('no seeded draft');
  }
  const [first, second, ...rest] = draft.items;
  if (first === undefined || second === undefined) {
    throw new Error('seeded draft too short');
  }
  useAppStore.setState({
    historyDrafts: {
      ...state.historyDrafts,
      [MOUNT_ID]: { ...draft, items: [second, first, ...rest] },
    },
  });
};

const mountWithPlan = async ({ isOwn }: { readonly isOwn: boolean }) => {
  seedResolveCommitsScene();
  planDraft();
  const seeded = useAppStore.getState();
  const draft = seeded.historyDrafts[MOUNT_ID];
  const edit = vi.fn(seeded.editHistoryDraft);
  useAppStore.setState({
    editHistoryDraft: edit as StoreState['editHistoryDraft'],
    loadReviewCommitDraft: async () => undefined,
    reviewCommitDrafts:
      isOwn && draft !== undefined
        ? {
            [MOUNT_ID]: reviewDraftSignature({
              headSha: draft.headSha,
              items: draft.items,
              onto: draft.onto,
            }),
          }
        : {},
  });
  render(
    <ToastProvider>
      <ReviewFlow session={SESSION} />
    </ToastProvider>,
  );
  await settle();
  await openCommits();
  return { edit };
};

describe('a plan left in Rewrite history', () => {
  it('is left alone until Replace it is clicked', async () => {
    const { edit } = await mountWithPlan({ isOwn: false });

    expect(screen.getByText('You have an unsaved plan in Rewrite history')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Fold each into its original' }));
    await settle();
    expect(edit).not.toHaveBeenCalled();
    expect(
      (screen.getByRole('button', { name: /Rewrite and push/ }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Replace it' }));
    await settle();
    expect(edit).toHaveBeenCalled();
    expect(screen.queryByText('You have an unsaved plan in Rewrite history')).toBeNull();
    expect(useAppStore.getState().reviewCommitDrafts[MOUNT_ID]).toBeDefined();
  });

  it('replaces a draft the Commits view made itself without asking', async () => {
    const { edit } = await mountWithPlan({ isOwn: true });

    expect(screen.queryByText('You have an unsaved plan in Rewrite history')).toBeNull();
    expect(edit).toHaveBeenCalled();
  });
});
