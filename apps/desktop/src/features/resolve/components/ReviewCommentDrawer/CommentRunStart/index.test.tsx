// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../../../../../app/components/MockScene/scenes/resolveSeed';
import { DrawerHost } from '../../../../../app/components/DrawerHost';
import { BranchPage } from '../../../../branch/components/BranchPage';
import { COMMENT_RUN_COPY } from '../../../commentRunCopy';

type StoreState = ReturnType<StoryStore['getState']>;

const AGENT = brandId<AgentId>({ value: 'agent-retry-backoff-run' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  stubStoryInvoke({ worktree_diff_range: '' });
});

afterEach(() => {
  cleanup();
});

type SpawnParams = {
  readonly spawn: StoreState['spawnAgent'];
};

const stubSpawn = ({ spawn }: SpawnParams) => {
  const spawnAgent = vi.fn<StoreState['spawnAgent']>(spawn);
  useAppStore.setState({
    spawnAgent,
    changeAutoLevel: vi.fn<StoreState['changeAutoLevel']>(async () => undefined),
  });
  return spawnAgent;
};

type OpenParams = {
  readonly threadId: string;
};

const form = (): HTMLElement | null =>
  screen.queryByRole('region', { name: COMMENT_RUN_COPY.label });

const shownForm = (): HTMLElement =>
  form() ??
  (() => {
    throw new Error('no comment run form');
  })();

const mount = async (): Promise<void> => {
  seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  await screen.findByRole('toolbar', { name: 'Comment actions' });
};

const openForm = async ({ threadId }: OpenParams): Promise<void> => {
  act(() => {
    useAppStore.getState().openCommentRunStart({ sessionId: SESSION.id, threadId });
  });
  await screen.findByRole('region', { name: COMMENT_RUN_COPY.label });
};

const goal = (): HTMLTextAreaElement =>
  within(shownForm()).getByRole<HTMLTextAreaElement>('textbox', { name: COMMENT_RUN_COPY.goal });

const sourceIds = (): ReadonlyArray<string | null> =>
  [...shownForm().querySelectorAll('[data-comment-run-source]')].map((node) =>
    node.getAttribute('data-comment-run-source'),
  );

const addFirstCandidate = async (): Promise<string> => {
  const item = shownForm().querySelector<HTMLElement>('[data-comment-run-candidate]');
  if (item === null) {
    throw new Error('no comment to add');
  }
  const threadId = item.getAttribute('data-comment-run-candidate') ?? '';
  fireEvent.click(within(item).getByRole('button'));
  await waitFor(() => expect(sourceIds()).toContain(threadId));
  return threadId;
};

const pressStart = (): void => {
  fireEvent.click(within(shownForm()).getByRole('button', { name: 'Start' }));
};

const openThread = (): string | null =>
  useAppStore.getState().commentRunStarts[SESSION.id]?.openThreadId ?? null;

describe('the start a run form in the comment drawer', () => {
  it('opens on the comment with a goal written from it and the comment as its source', async () => {
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });

    expect(goal().value).toMatch(/^Change retryPolicy\.ts:\d+ as the comment asks/);
    expect(sourceIds()).toEqual([EXPANDED_THREAD_ID]);
    expect(screen.queryByRole('toolbar', { name: 'Comment actions' })).toBeNull();
    within(shownForm()).getByText(COMMENT_RUN_COPY.hostNote);
  });

  it('starts one Lead from the comment and an added one, quoting both, then closes the form', async () => {
    const spawnAgent = stubSpawn({ spawn: async () => AGENT });
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const added = await addFirstCandidate();

    expect(sourceIds()).toEqual([EXPANDED_THREAD_ID, added]);
    expect(goal().value).toMatch(/as the comments ask/);
    pressStart();
    await waitFor(() => expect(form()).toBeNull());

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    const [sessionId, options] = spawnAgent.mock.calls[0] ?? [];
    expect(sessionId).toBe(SESSION.id);
    expect(options).toMatchObject({
      kindOverride: 'auto',
      sourceKind: 'comment_run',
      sourceThreadIds: [EXPANDED_THREAD_ID, added],
    });
    expect(options?.initialPrompt).toContain('The comments this run comes from, word for word:');
    expect(options?.initialPrompt?.match(/^A GitHub comment from /gm)).toHaveLength(2);
    expect(openThread()).toBeNull();
    expect(useAppStore.getState().commentRunStarts[SESSION.id]?.drafts).toEqual({});
  });

  it('keeps the edited goal and the added comment after Cancel, for the next open', async () => {
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const added = await addFirstCandidate();
    fireEvent.change(goal(), {
      target: { value: 'Rework the retry policy with a jittered backoff' },
    });

    fireEvent.click(within(shownForm()).getByRole('button', { name: COMMENT_RUN_COPY.cancel }));
    await screen.findByRole('toolbar', { name: 'Comment actions' });
    expect(form()).toBeNull();

    await openForm({ threadId: EXPANDED_THREAD_ID });
    expect(goal().value).toBe('Rework the retry policy with a jittered backoff');
    expect(sourceIds()).toEqual([EXPANDED_THREAD_ID, added]);
  });

  it('keeps the text and the comments after a failed start, and offers Retry', async () => {
    const spawnAgent = stubSpawn({
      spawn: async () => {
        throw new Error('The agent could not start');
      },
    });
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const added = await addFirstCandidate();
    fireEvent.change(goal(), { target: { value: 'Rework the retry policy' } });
    pressStart();

    await within(shownForm()).findByText(/The agent could not start/);
    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(goal().value).toBe('Rework the retry policy');
    expect(sourceIds()).toEqual([EXPANDED_THREAD_ID, added]);
    within(shownForm()).getByRole('button', { name: 'Retry' });
    expect(openThread()).toBe(EXPANDED_THREAD_ID);
  });

  it('links the comments the start began with when another comment is opened before it answers', async () => {
    let answer: (agentId: AgentId) => void = () => undefined;
    const spawnAgent = stubSpawn({
      spawn: () =>
        new Promise<AgentId>((resolve) => {
          answer = resolve;
        }),
    });
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    pressStart();
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(1));

    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'conversation',
        sessionId: SESSION.id,
        payload: { threadId: THREAD_IDS.retryConstant },
      });
    });
    await waitFor(() => expect(form()).toBeNull());

    await act(async () => {
      answer(AGENT);
    });
    await waitFor(() => expect(openThread()).toBeNull());

    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ sourceThreadIds: [EXPANDED_THREAD_ID] });
    expect(useAppStore.getState().commentRunStarts[SESSION.id]?.drafts).toEqual({});
    expect(form()).toBeNull();
  });

  it('blocks Start for a comment another run already holds', async () => {
    const spawnAgent = stubSpawn({ spawn: async () => AGENT });
    await mount();
    act(() => {
      useAppStore.setState({
        sessionPhaseRuns: {
          [SESSION.id]: [
            anAgent({
              id: brandId<AgentId>({ value: 'agent-retry-backoff-earlier' }),
              sessionId: SESSION.id,
              ordinal: 1,
              status: 'running',
              kind: 'auto',
              sourceKind: 'comment_run',
              sourceThreadIds: [EXPANDED_THREAD_ID],
            }),
          ],
        },
      });
    });
    await openForm({ threadId: EXPANDED_THREAD_ID });

    const start = within(shownForm()).getByRole<HTMLButtonElement>('button', { name: 'Start' });
    expect(start.disabled).toBe(true);
    within(shownForm()).getByText(COMMENT_RUN_COPY.inRun);
    fireEvent.click(start);
    expect(spawnAgent).not.toHaveBeenCalled();
  });
});
