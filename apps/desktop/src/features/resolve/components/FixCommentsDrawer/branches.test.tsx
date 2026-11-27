// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ResolveBatch } from '@goodboy/types';
import { agentIdOf } from '../../../../__tests__/helpers/brandedIds';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  BULK_COMMENT_MOUNT_ID,
  BULK_LAUNCH_THREAD_IDS,
  seedBulkBranches,
  type BulkAnalysis,
} from '../../../../app/components/MockScene/scenes/bulkSeed';
import {
  BITBUCKET_MOUNT_ID,
  seedResolveBitbucketScene,
} from '../../../../app/components/MockScene/scenes/resolveBitbucketSeed';
import { seedResolveGitlabScene } from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
import { useReviewEntries } from '../ReviewFlow/useReviewEntries';
import { IN_RUN_REASON, rowQualifierOf } from '../ReviewFlow/rowQualifier';
import { FixCommentsDrawer } from '.';

type StoreState = ReturnType<StoryStore['getState']>;

const BATCH: ResolveBatch = {
  id: 'batch-fix',
  sessionId: SESSION.id,
  threadIds: [],
  launchChoice: {
    provider: 'anthropic',
    model: 'claude-sonnet-5-5',
    effort: null,
    commitStyle: null,
    hint: null,
  },
  createdAt: 1,
};

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

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({ analysis }: { readonly analysis: BulkAnalysis }): Promise<void> => {
  seedBulkBranches({ analysis });
  render(
    <ToastProvider>
      <FixCommentsDrawer
        sessionId={SESSION.id}
        mountId={BULK_COMMENT_MOUNT_ID}
        focusThreadId={null}
        threadIds={null}
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );
  await settle();
};

const drawer = (): HTMLElement => screen.getByRole('region', { name: 'Fix comments' });

describe('the Fix comments drawer on a session with several branches', () => {
  it('lists each comment of its own branch by its text', async () => {
    await mount({ analysis: 'none' });

    expect(within(drawer()).queryByText('Comment unavailable')).toBeNull();
    expect(within(drawer()).getAllByRole('checkbox')).toHaveLength(BULK_LAUNCH_THREAD_IDS.length);
    within(drawer()).getByText(/MAX_RETRY_ATTEMPTS now lives in two places/);
  });

  it('keeps an analyzed comment selectable and counted, and starts the fix on all of them', async () => {
    const spawnAgent = vi.fn<StoreState['spawnAgent']>(async () =>
      agentIdOf({ value: 'agent-new' }),
    );
    const createResolveBatch = vi.fn<StoreState['createResolveBatch']>(async () => BATCH);
    const setAgentConfig = vi.fn<StoreState['setAgentConfig']>(async () => undefined);
    useAppStore.setState({ spawnAgent, createResolveBatch, setAgentConfig });
    await mount({ analysis: 'completed' });

    const count = BULK_LAUNCH_THREAD_IDS.length;
    const analyzed = within(drawer()).getAllByRole('checkbox')[0];
    expect(analyzed).toHaveProperty('checked', true);
    fireEvent.click(within(drawer()).getByRole('button', { name: `Start fix for ${count}` }));

    await waitFor(() => expect(createResolveBatch).toHaveBeenCalledOnce());
    expect([...(createResolveBatch.mock.calls[0]?.[0].threadIds ?? [])].sort()).toEqual(
      [...BULK_LAUNCH_THREAD_IDS].sort(),
    );
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(within(drawer()).queryByText(/no longer on the pull request/)).toBeNull();
  });

  it('leaves out a comment that a fix is still running on and says why', async () => {
    await mount({ analysis: 'running' });

    expect(within(drawer()).getAllByRole('checkbox')).toHaveLength(
      BULK_LAUNCH_THREAD_IDS.length - 1,
    );
    const { result } = renderHook(() =>
      useReviewEntries({ sessionId: SESSION.id, scope: 'branch', mountId: BULK_COMMENT_MOUNT_ID }),
    );
    const running = result.current.all.find(
      (entry) => entry.threadId === BULK_LAUNCH_THREAD_IDS[0],
    );
    expect(running?.isFixable).toBe(false);
    expect(running === undefined ? null : rowQualifierOf({ entry: running })).toBe(IN_RUN_REASON);
  });

  it('counts the same comments for the list, the bar and the panel', async () => {
    await mount({ analysis: 'completed' });

    const { result } = renderHook(() =>
      useReviewEntries({ sessionId: SESSION.id, scope: 'branch', mountId: BULK_COMMENT_MOUNT_ID }),
    );
    const fixable = result.current.all.filter((entry) => entry.isFixable).length;
    expect(fixable).toBe(BULK_LAUNCH_THREAD_IDS.length);
    within(drawer()).getByRole('button', { name: `Start fix for ${fixable}` });
    expect(within(drawer()).getAllByRole('checkbox')).toHaveLength(fixable);
  });
});

describe('the Fix comments drawer on every host', () => {
  it('lists a Bitbucket comment by its text, its place and its author', async () => {
    seedResolveBitbucketScene({ selected: 'bitbucket' });
    render(
      <ToastProvider>
        <FixCommentsDrawer
          sessionId={SESSION.id}
          mountId={BITBUCKET_MOUNT_ID}
          focusThreadId={null}
          threadIds={null}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );
    await settle();

    expect(within(drawer()).queryByText('Comment unavailable')).toBeNull();
    within(drawer()).getByText(/The button stays enabled for a moment/);
    within(drawer()).getByText('joao-r');
    within(drawer()).getByText(':58');
  });

  it('lists a GitLab comment by its text', async () => {
    seedResolveGitlabScene({ selected: 'gitlab' });
    render(
      <ToastProvider>
        <FixCommentsDrawer
          sessionId={SESSION.id}
          focusThreadId={null}
          threadIds={null}
          onClose={vi.fn()}
        />
      </ToastProvider>,
    );
    await settle();

    expect(within(drawer()).queryByText('Comment unavailable')).toBeNull();
    within(drawer()).getByText(/Retry the send when the provider returns a 503/);
  });
});
