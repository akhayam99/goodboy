// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  EXPANDED_THREAD_ID,
  SESSION,
  THREAD_IDS,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { DrawerHost } from '../../../../app/components/DrawerHost';
import { BranchPage } from '../../../branch/components/BranchPage';
import { COMMENT_RUN_COPY } from '../../commentRunCopy';

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

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

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

const mount = async (): Promise<void> => {
  seedResolveScene({ expandedThreadId: EXPANDED_THREAD_ID });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
};

const openForm = async ({ threadId }: OpenParams): Promise<void> => {
  act(() => {
    useAppStore.getState().openCommentRunStart({ sessionId: SESSION.id, threadId });
  });
  await settle();
};

const form = (): HTMLElement | null =>
  screen.queryByRole('region', { name: COMMENT_RUN_COPY.label });

const shownForm = (): HTMLElement =>
  form() ??
  (() => {
    throw new Error('no comment run form');
  })();

const goal = (): HTMLTextAreaElement =>
  within(shownForm()).getByRole<HTMLTextAreaElement>('textbox', { name: COMMENT_RUN_COPY.goal });

const sourceIds = (): ReadonlyArray<string | null> =>
  [...shownForm().querySelectorAll('[data-comment-run-source]')].map((node) =>
    node.getAttribute('data-comment-run-source'),
  );

const firstCandidate = (): HTMLElement => {
  const item = shownForm().querySelector<HTMLElement>('[data-comment-run-candidate]');
  if (item === null) {
    throw new Error('no comment to add');
  }
  return item;
};

const addFirstCandidate = async (): Promise<string> => {
  const item = firstCandidate();
  const threadId = item.getAttribute('data-comment-run-candidate') ?? '';
  fireEvent.click(within(item).getByRole('button'));
  await settle();
  return threadId;
};

const pressStart = async (): Promise<void> => {
  fireEvent.click(within(shownForm()).getByRole('button', { name: 'Start' }));
  await settle();
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
    expect(within(shownForm()).getByText(COMMENT_RUN_COPY.hostNote)).toBeTruthy();
  });

  it('starts one Lead from the comment and an added one, quoting both, then closes the form', async () => {
    const spawnAgent = stubSpawn({ spawn: async () => AGENT });
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const added = await addFirstCandidate();

    expect(sourceIds()).toEqual([EXPANDED_THREAD_ID, added]);
    expect(goal().value).toMatch(/as the comments ask/);
    await pressStart();

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
    expect(form()).toBeNull();
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
    await settle();

    fireEvent.click(within(shownForm()).getByRole('button', { name: COMMENT_RUN_COPY.cancel }));
    await settle();
    expect(form()).toBeNull();
    expect(screen.getByRole('toolbar', { name: 'Comment actions' })).toBeTruthy();

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
    await settle();
    await pressStart();

    expect(spawnAgent).toHaveBeenCalledTimes(1);
    expect(within(shownForm()).getByText(/The agent could not start/)).toBeTruthy();
    expect(goal().value).toBe('Rework the retry policy');
    expect(sourceIds()).toEqual([EXPANDED_THREAD_ID, added]);
    expect(within(shownForm()).getByRole('button', { name: 'Retry' })).toBeTruthy();
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
    await pressStart();
    expect(spawnAgent).toHaveBeenCalledTimes(1);

    act(() => {
      useAppStore.getState().openDrawer({
        kind: 'conversation',
        sessionId: SESSION.id,
        payload: { threadId: THREAD_IDS.retryConstant },
      });
    });
    await settle();
    expect(form()).toBeNull();

    await act(async () => {
      answer(AGENT);
    });
    await settle();

    expect(spawnAgent.mock.calls[0]?.[1]).toMatchObject({ sourceThreadIds: [EXPANDED_THREAD_ID] });
    expect(openThread()).toBeNull();
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
    expect(within(shownForm()).getByText(COMMENT_RUN_COPY.inRun)).toBeTruthy();
    fireEvent.click(start);
    await settle();
    expect(spawnAgent).not.toHaveBeenCalled();
  });
});
