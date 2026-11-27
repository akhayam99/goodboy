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
import { brandId, type AgentId, type MountId } from '@goodboy/types';
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
  FIX_RUN_MOUNT,
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

  it('reads top to bottom in one section per job, each with one label', async () => {
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const labels = [...shownForm().querySelectorAll('[data-form-section]')].map((node) =>
      node.getAttribute('data-form-section'),
    );
    expect(labels).toEqual(['What', 'Plan', 'Rules', 'Model', 'Scope']);
    const rules = within(shownForm()).getByRole('group', { name: 'Rules' });
    expect(rules.querySelector('[data-start-settings-line]')).not.toBeNull();
    expect(rules.querySelector('[data-start-settings-change]')).not.toBeNull();
    const model = within(shownForm()).getByRole('group', { name: 'Model' });
    expect(model.querySelector('[data-where-it-runs] svg')).not.toBeNull();
    within(model).getByRole('button', { name: /Change/ });
  });

  it('names the host once and draws every comment as the same chip', async () => {
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const added = await addFirstCandidate();
    const what = within(shownForm()).getByRole('group', { name: 'What' });
    expect(what.textContent?.match(/GitHub/g)).toHaveLength(1);
    within(what).getByText(COMMENT_RUN_COPY.sourcesFrom({ label: 'GitHub' }));
    const chips = [EXPANDED_THREAD_ID, added].map((id) =>
      what.querySelector(`[data-comment-run-source="${id}"]`),
    );
    expect(chips.every((chip) => chip !== null)).toBe(true);
  });

  it('offers the other comments under one Add label, each as a button to add', async () => {
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const what = within(shownForm()).getByRole('group', { name: 'What' });
    within(what).getByText(COMMENT_RUN_COPY.addCaption);
    const offers = what.querySelectorAll('[data-comment-run-candidate]');
    expect(offers.length).toBeGreaterThan(0);
    const labels = within(what)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(labels).toHaveLength(offers.length);
    for (const label of labels) {
      expect(label).toMatch(/^Add .+ to the run$/);
    }
  });

  it('ends with Cancel then Start in one row, with no divider or footer bar', async () => {
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const cancel = within(shownForm()).getByRole('button', { name: COMMENT_RUN_COPY.cancel });
    const start = within(shownForm()).getByRole('button', { name: 'Start' });
    expect(cancel.parentElement).toBe(start.parentElement);
    expect(cancel.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(shownForm().querySelector('footer, hr, [role="separator"]')).toBeNull();
    const sections = shownForm().querySelectorAll('[data-form-section]');
    const last = [...sections].pop();
    expect(last).toBeDefined();
    expect(
      (last?.compareDocumentPosition(cancel) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('counts the one project the comments belong to, not every mounted project', async () => {
    await mount();
    const names = ['ledger-core', 'notify-relay', 'northwind-web'];
    act(() => {
      useAppStore.setState((state) => ({
        sessionProjectMounts: {
          ...state.sessionProjectMounts,
          [SESSION.id]: [
            FIX_RUN_MOUNT,
            ...names.map((name) => ({
              ...FIX_RUN_MOUNT,
              mountName: name,
              mountId: brandId<MountId>({ value: `mock-mount-${name}` }),
            })),
          ],
        },
        sessionExternalTasks: {
          ...state.sessionExternalTasks,
          [SESSION.id]: [
            {
              sessionId: SESSION.id,
              provider: 'github',
              externalId: '42',
              identifier: 'harborline/payments-api#42',
              url: 'https://github.com/harborline/payments-api/issues/42',
              title: 'Duplicate credit on retry',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      }));
    });
    await openForm({ threadId: EXPANDED_THREAD_ID });
    const scope = within(shownForm()).getByRole('group', { name: 'Scope' });
    expect(scope.textContent).not.toMatch(/across/);
    expect(scope.textContent).toMatch(/Starts as Lead/);
  });

  it('keeps the Scope section when the plan changes to One agent', async () => {
    await mount();
    await openForm({ threadId: EXPANDED_THREAD_ID });
    fireEvent.click(within(shownForm()).getByRole('tab', { name: 'One agent' }));
    const scope = await within(shownForm()).findByRole('group', { name: 'Scope' });
    expect(scope.textContent).toContain('One agent, on the project the comments belong to');
  });
});
