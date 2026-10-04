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
  EXPANDED_THREAD_ID,
  SESSION,
  seedResolveScene,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import type { AgentId, ResolveBatch } from '@goodboy/types';
import { BranchPage } from '../../../branch/components/BranchPage';

type StoreState = ReturnType<StoryStore['getState']>;

const BATCH: ResolveBatch = {
  id: 'batch-1',
  sessionId: SESSION.id,
  threadIds: [],
  launchChoice: {
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    effort: null,
    commitStyle: null,
    hint: null,
  },
  createdAt: 1,
};

let useAppStore: StoryStore;
let restore: Partial<StoreState> = {};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
  useAppStore.setState(restore);
  restore = {};
});

const stub = (actions: Partial<StoreState>): void => {
  const state = useAppStore.getState();
  restore = {
    ...Object.fromEntries(Object.keys(actions).map((key) => [key, state[key as keyof StoreState]])),
    ...restore,
  };
  useAppStore.setState(actions);
};

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({
  threadId,
  selectable = false,
}: {
  readonly threadId: string | null;
  readonly selectable?: boolean;
}): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId, selectable });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await settle();
};

const FAILED_THREAD_ID = 'PRRT_thread_idempotency';
const NOT_STARTED_THREAD_ID = 'PRRT_thread_retry_constant';

const mountFailed = async ({
  failure,
  threadId = FAILED_THREAD_ID,
}: {
  readonly failure: 'run' | 'history';
  readonly threadId?: string;
}): Promise<void> => {
  seedResolveScene({ expandedThreadId: threadId, failure });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await settle();
};

const list = (): HTMLElement => screen.getByRole('navigation', { name: 'Comments' });

const row = (name: RegExp): HTMLElement =>
  within(list())
    .getAllByRole('button')
    .find((candidate) => name.test(candidate.textContent ?? '')) ??
  (() => {
    throw new Error(`no row ${String(name)}`);
  })();

const comment = (): HTMLElement => screen.getByRole('article', { name: 'Comment' });

const focusedThread = (): string | null => comment().getAttribute('data-review-comment');

const press = (key: string, code: string, init: KeyboardEventInit = {}): void => {
  fireEvent.keyDown(document.activeElement ?? list(), { key, code, ...init });
};

describe('Review as one flow', () => {
  it('shows the list and the focused comment side by side, with no drawer', async () => {
    await mount({ threadId: EXPANDED_THREAD_ID });

    expect(within(list()).getByRole('region', { name: 'Open' })).toBeDefined();
    expect(within(list()).getByRole('region', { name: 'Ready to push' })).toBeDefined();
    expect(within(list()).getByRole('region', { name: 'Done' })).toBeDefined();
    expect(focusedThread()).toBe(EXPANDED_THREAD_ID);
    expect(screen.queryByRole('complementary', { name: 'Conversation' })).toBeNull();
    expect(document.querySelector('[data-conversation-slot]')).toBeNull();
    expect(within(comment()).getByRole('button', { name: /^Accept/ })).toBeDefined();
  });

  it('counts each state group in its own title and has no summary line or filter menu', async () => {
    await mount({ threadId: null });

    expect(within(list()).getByRole('region', { name: 'Open' }).textContent).toMatch(/Open \d+/);
    expect(within(list()).getByRole('region', { name: 'Done' }).textContent).toMatch(/Done \d+/);
    expect(screen.queryByLabelText('Comment summary')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Filter comments' })).toBeNull();
  });

  it('names every state with its own word and never says Resolve on a control', async () => {
    await mount({ threadId: null });

    const words = within(list())
      .getAllByRole('button')
      .map((button) => button.textContent ?? '');
    expect(words.some((text) => text.includes('Ready'))).toBe(true);
    expect(words.some((text) => text.includes('Needs you'))).toBe(true);
    expect(words.some((text) => text.includes('Drafting'))).toBe(true);
    expect(words.some((text) => text.includes('Not started'))).toBe(true);
    expect(words.some((text) => text.includes('Skipped'))).toBe(true);
    expect(words.some((text) => text.includes('Pushed'))).toBe(true);
    const labels = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    expect(
      labels.filter((label) => /^Resolve\b/.test(label) && label !== 'Resolve without a reply'),
    ).toEqual([]);
    expect(within(comment()).queryByRole('button', { name: 'Resolve without a reply' })).toBeNull();
  });

  it('never starts an agent by opening Review, and Fix opens the strip before anything runs', async () => {
    const spawnAgent = vi.fn<StoreState['spawnAgent']>(async () => 'agent-1' as AgentId);
    const createResolveBatch = vi.fn<StoreState['createResolveBatch']>(async () => BATCH);
    stub({
      spawnAgent: spawnAgent,
      createResolveBatch: createResolveBatch,
    });
    await mount({ threadId: NOT_STARTED_THREAD_ID });

    expect(spawnAgent).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Fix launch' })).toBeNull();
    fireEvent.click(within(comment()).getByRole('button', { name: /^Fix/ }));

    const strip = await screen.findByRole('region', { name: 'Fix launch' });
    expect(within(strip).getByText('Fix this comment')).toBeDefined();
    expect(spawnAgent).not.toHaveBeenCalled();
    fireEvent.click(within(strip).getByRole('button', { name: /^Start/ }));
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    expect(createResolveBatch).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Fix launch' })).toBeNull());
    expect(screen.getByRole('status').textContent).toMatch(/1 agent started on/);
  });

  it('opens the strip with F on the focused row, prefilled from settings, and Esc closes it', async () => {
    await mount({ threadId: NOT_STARTED_THREAD_ID });

    row(/config\.ts/).focus();
    press('f', 'KeyF');

    const strip = await screen.findByRole('region', { name: 'Fix launch' });
    expect(
      within(strip).getByRole('tab', { name: 'New commit' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(within(strip).getByRole('tab', { name: 'Fixup of the original' })).toBeDefined();
    fireEvent.keyDown(within(strip).getByLabelText('Notes for the agents'), {
      key: 'Escape',
      code: 'Escape',
    });
    expect(screen.queryByRole('region', { name: 'Fix launch' })).toBeNull();
  });

  it('starts with the submit chord and sends the hint, model and commit style on the batch', async () => {
    const spawnAgent = vi.fn<StoreState['spawnAgent']>(async () => 'agent-1' as AgentId);
    const createResolveBatch = vi.fn<StoreState['createResolveBatch']>(async () => BATCH);
    stub({
      spawnAgent: spawnAgent,
      createResolveBatch: createResolveBatch,
    });
    await mount({ threadId: NOT_STARTED_THREAD_ID });

    fireEvent.click(within(comment()).getByRole('button', { name: /^Fix/ }));
    const strip = await screen.findByRole('region', { name: 'Fix launch' });
    fireEvent.click(within(strip).getByRole('tab', { name: 'Fixup of the original' }));
    const hint = within(strip).getByLabelText('Notes for the agents');
    fireEvent.change(hint, { target: { value: 'Keep the public API unchanged' } });
    fireEvent.keyDown(hint, { key: 'Enter', code: 'Enter', ctrlKey: true });

    await waitFor(() => expect(createResolveBatch).toHaveBeenCalledOnce());
    const [call] = createResolveBatch.mock.calls[0] ?? [];
    expect(call?.threadIds).toEqual([NOT_STARTED_THREAD_ID]);
    expect(call?.launchChoice).toMatchObject({
      commitStyle: 'fixup',
      hint: 'Keep the public API unchanged',
    });
    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
  });

  it('puts Fix on the row of a comment nobody started, and nowhere else', async () => {
    await mount({ threadId: null });

    const fixRows = Array.from(list().querySelectorAll('[data-fix-row]')).map((node) =>
      node.getAttribute('data-fix-row'),
    );
    expect(fixRows).toContain(NOT_STARTED_THREAD_ID);
    expect(fixRows).not.toContain(EXPANDED_THREAD_ID);
    expect(fixRows).not.toContain(FAILED_THREAD_ID);
    expect(screen.queryByRole('button', { name: /^Draft (a fix|fixes)/ })).toBeNull();
  });

  it('checks a not started row from its checkbox and shows the selection bar', async () => {
    await mount({ threadId: null, selectable: true });

    expect(screen.queryByRole('toolbar', { name: 'Selected comments' })).toBeNull();
    const boxes = within(list()).getAllByRole('checkbox');
    const fixable = Array.from(list().querySelectorAll('[data-fix-row]')).length;
    expect(boxes.length).toBe(fixable);
    fireEvent.click(boxes[0] as HTMLElement);

    const bar = screen.getByRole('toolbar', { name: 'Selected comments' });
    expect(within(bar).getByText('1 selected')).toBeDefined();
    expect(list().querySelectorAll('[data-fix-row]').length).toBe(0);
    fireEvent.click(within(bar).getByRole('button', { name: 'Clear selection' }));
    expect(screen.queryByRole('toolbar', { name: 'Selected comments' })).toBeNull();
  });

  it('toggles the focused row with X and selects every not started comment with Cmd+A', async () => {
    await mount({ threadId: NOT_STARTED_THREAD_ID, selectable: true });

    row(/config\.ts/).focus();
    press('x', 'KeyX');
    expect(useAppStore.getState().reviewSelection[SESSION.id]).toEqual([NOT_STARTED_THREAD_ID]);
    press('x', 'KeyX');
    expect(useAppStore.getState().reviewSelection[SESSION.id]).toEqual([]);

    press('a', 'KeyA', { ctrlKey: true });
    const all = useAppStore.getState().reviewSelection[SESSION.id] ?? [];
    expect(all.length).toBeGreaterThan(1);
    expect(all).toContain(NOT_STARTED_THREAD_ID);
    expect(all).not.toContain(EXPANDED_THREAD_ID);
    expect(
      within(screen.getByRole('toolbar', { name: 'Selected comments' })).getByText(
        `${all.length} selected`,
      ),
    ).toBeDefined();
  });

  it('starts one agent per selected comment in one batch from the strip', async () => {
    const spawnAgent = vi.fn<StoreState['spawnAgent']>(async () => 'agent-1' as AgentId);
    const createResolveBatch = vi.fn<StoreState['createResolveBatch']>(async () => BATCH);
    stub({
      spawnAgent: spawnAgent,
      createResolveBatch: createResolveBatch,
    });
    await mount({ threadId: null, selectable: true });

    row(/config\.ts/).focus();
    press('a', 'KeyA', { ctrlKey: true });
    const selected = [...(useAppStore.getState().reviewSelection[SESSION.id] ?? [])];
    const bar = screen.getByRole('toolbar', { name: 'Selected comments' });
    fireEvent.click(within(bar).getByRole('button', { name: /^Fix \d+ separately/ }));

    const strip = await screen.findByRole('region', { name: 'Fix launch' });
    expect(
      within(strip).getByText(`Fix ${selected.length} comments, one agent each`),
    ).toBeDefined();
    expect(within(strip).getByText(/up to 4 run at once/)).toBeDefined();
    fireEvent.click(within(strip).getByRole('button', { name: /^Start \d+ agents/ }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledTimes(selected.length));
    expect(createResolveBatch).toHaveBeenCalledOnce();
    const [call] = createResolveBatch.mock.calls[0] ?? [];
    expect([...(call?.threadIds ?? [])].sort()).toEqual([...selected].sort());
    await waitFor(() =>
      expect(useAppStore.getState().reviewSelection[SESSION.id] ?? []).toEqual([]),
    );
  });

  it('says a queued batch comment is waiting for a free slot', async () => {
    seedResolveScene({ expandedThreadId: 'PRRT_thread_idempotency' });
    const state = useAppStore.getState();
    const attempts = state.sessionResolveAttempts[SESSION.id] ?? [];
    stub({
      sessionResolveAttempts: {
        ...state.sessionResolveAttempts,
        [SESSION.id]: attempts.map((attempt) =>
          attempt.threadIds.includes('PRRT_thread_idempotency')
            ? { ...attempt, phase: 'queued' as const, batchId: 'batch-1' }
            : attempt,
        ),
      },
    });
    render(
      <ToastProvider>
        <BranchPage session={SESSION} workingDir={null} />
      </ToastProvider>,
    );
    await settle();

    expect(row(/idempotency\.ts/).textContent).toContain('Waiting');
    expect(within(comment()).getByText('Waiting for a free slot')).toBeDefined();
  });

  it('accepts with A: marks it, publishes nothing, and moves to the next open comment', async () => {
    const accept = vi.fn<StoreState['acceptResolveQueueItem']>(async () => undefined);
    const publish = vi.fn<StoreState['publishConversations']>(async () => ({ kind: 'missing' }));
    stub({
      acceptResolveQueueItem: accept,
      publishConversations: publish,
    });
    await mount({ threadId: EXPANDED_THREAD_ID });

    row(/retryPolicy\.ts:42/).focus();
    press('a', 'KeyA');

    await waitFor(() => expect(accept).toHaveBeenCalledOnce());
    expect(accept).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION.id, revision: 1, reply: expect.any(String) }),
    );
    expect(publish).not.toHaveBeenCalled();
    await waitFor(() => expect(focusedThread()).not.toBe(EXPANDED_THREAD_ID));
  });

  it('names a real edit with the text before and after, who wrote it, and Keep the draft', async () => {
    await mount({ threadId: 'PRRT_thread_typo' });

    expect(row(/Comment changed/)).toBeDefined();
    const card = within(comment()).getByRole('region', { name: 'Comment edited' });
    expect(within(card).getByText(/Edited by kenji-w/)).toBeDefined();
    expect(card.textContent).toContain('Also rename the flag to shouldRetry.');
    expect(
      within(comment()).getByRole('button', { name: /^Redraft with the new comment/ }),
    ).toBeDefined();
    const settle = vi.fn(async () => undefined);
    stub({ settleResolveSourceChange: settle });
    fireEvent.click(within(comment()).getByRole('button', { name: /^Keep the draft/ }));
    await waitFor(() =>
      expect(settle).toHaveBeenCalledWith({
        sessionId: SESSION.id,
        threadId: 'PRRT_thread_typo',
        keepDraft: true,
      }),
    );
  });

  it('shows a new reply as a fact and keeps Accept available', async () => {
    await mount({ threadId: 'PRRT_thread_retry_metrics' });

    expect(row(/Same loop should emit/).textContent).not.toContain('Comment changed');
    const note = within(comment()).getByText('New reply from nadia-p');
    expect(note).toBeDefined();
    expect(within(comment()).getAllByText(/A counter per give-up reason/).length).toBeGreaterThan(
      0,
    );
    expect(within(comment()).getByRole('button', { name: /^Accept/ })).toBeDefined();
  });

  it('shows the moved line as a fact on the comment without changing its state', async () => {
    await mount({ threadId: 'PRRT_thread_flaky_test' });

    expect(within(comment()).getByText('The line moved')).toBeDefined();
    expect(row(/This test sleeps/).textContent).not.toContain('Comment changed');
  });

  it('moves with J and K while the list has focus', async () => {
    await mount({ threadId: EXPANDED_THREAD_ID });
    row(/retryPolicy\.ts:42/).focus();

    press('j', 'KeyJ');
    await settle();
    const second = focusedThread();
    expect(second).not.toBe(EXPANDED_THREAD_ID);
    press('k', 'KeyK');
    await settle();
    expect(focusedThread()).toBe(EXPANDED_THREAD_ID);
  });

  it('replies without a change from one text box: R, type, Cmd+Enter, Enter adds a line', async () => {
    const refuse = vi.fn<StoreState['refuseResolveQueueItem']>(async () => undefined);
    stub({ refuseResolveQueueItem: refuse });
    await mount({ threadId: EXPANDED_THREAD_ID });

    row(/retryPolicy\.ts:42/).focus();
    press('r', 'KeyR');
    const box = await within(comment()).findByRole('textbox', { name: 'Your reply' });
    fireEvent.change(box, { target: { value: 'We keep the cap at 6 on purpose.' } });
    expect(fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' })).toBe(true);
    expect(refuse).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter', metaKey: true });

    await waitFor(() => expect(refuse).toHaveBeenCalledOnce());
    expect(refuse).toHaveBeenCalledWith(
      expect.objectContaining({ reply: 'We keep the cap at 6 on purpose.', revision: 1 }),
    );
  });

  it('skips with S and undoes a skip from the waiting group', async () => {
    const defer = vi.fn<StoreState['deferResolveQueueItem']>(async () => undefined);
    const takeUp = vi.fn<StoreState['takeUpResolveQueueItem']>(async () => undefined);
    stub({
      deferResolveQueueItem: defer,
      takeUpResolveQueueItem: takeUp,
    });
    await mount({ threadId: EXPANDED_THREAD_ID });

    row(/retryPolicy\.ts:42/).focus();
    press('s', 'KeyS');
    await waitFor(() => expect(defer).toHaveBeenCalledOnce());

    fireEvent.click(row(/Skipped/));
    await settle();
    fireEvent.click(within(comment()).getByRole('button', { name: /^Resume/ }));
    await waitFor(() => expect(takeUp).toHaveBeenCalledOnce());
  });

  it('answers the agent with E on a comment that needs you', async () => {
    await mount({ threadId: null });
    fireEvent.click(row(/Needs you/));
    await settle();
    row(/Needs you/).focus();
    press('e', 'KeyE');

    expect(await within(comment()).findByRole('textbox', { name: 'Your answer' })).toBeDefined();
    fireEvent.keyDown(within(comment()).getByRole('textbox', { name: 'Your answer' }), {
      key: 'Escape',
      code: 'Escape',
    });
    await settle();
    expect(within(comment()).queryByRole('textbox', { name: 'Your answer' })).toBeNull();
  });

  it('keeps Stop and the transcript on the properties of a drafting comment, not in a menu', async () => {
    await mount({ threadId: null });
    fireEvent.click(row(/Drafting/));
    await settle();

    expect(within(comment()).queryAllByRole('button', { name: /^Accept|^Edit|^Reply/ })).toEqual(
      [],
    );
    expect(screen.queryByRole('button', { name: 'Comment actions' })).toBeNull();
    const properties = screen.getAllByLabelText('Comment properties')[0] as HTMLElement;
    expect(within(properties).getByRole('button', { name: 'Stop' })).toBeDefined();
  });

  it('opens the not started comment with Fix as its one primary', async () => {
    await mount({ threadId: 'PRRT_thread_retry_constant' });

    const verbs = within(comment())
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-review-verb'))
      .map((button) => button.getAttribute('data-review-verb'));
    expect(verbs).toEqual(['reviewComment.draft', 'reviewComment.reply', 'reviewComment.skip']);
  });

  it('pushes once from the header: confirm names what goes out, then one result line', async () => {
    const preview = {
      publicationId: 'pub-318',
      repo: 'harborline/payments-api',
      prNumber: 318,
      branch: 'hl/fix-duplicate-credit',
      localHead: 'a41c9e2aaaa',
      remoteHead: '7d02b11bbbb',
      requiresPush: true,
      frozenAt: 1,
      commits: [
        {
          sha: 'a41c9e2aaaa',
          shortSha: 'a41c9e2',
          subject: 'Redact the webhook payload',
          author: 'resolver',
          timestamp: 1,
          pushed: false,
          parentSha: null,
          threadIds: ['PRRT_thread_log_redact'],
        },
      ],
      unapproved: [],
      replies: [
        { threadId: 'PRRT_thread_log_redact', body: 'Redacted.', revision: 1, closes: true },
      ],
      notes: [],
      excluded: [],
      drift: [],
      blocker: null,
    };
    const prepare = vi.fn<StoreState['preparePublication']>(async () => preview);
    const publish = vi.fn<StoreState['publishConversations']>(async () => ({
      kind: 'done' as const,
      pushed: true,
      pushedHead: 'a41c9e2aaaa',
      total: 1,
      replies: 1,
      replied: 1,
      closed: 1,
      resolved: 1,
      leftOpen: 0,
      failed: 0,
      error: null,
    }));
    stub({
      preparePublication: prepare,
      publishConversations: publish,
    });
    await mount({ threadId: EXPANDED_THREAD_ID });

    fireEvent.click(screen.getByRole('button', { name: /^Push 1/ }));
    const confirm = await screen.findByRole('group', {
      name: 'Push 1 to hl/fix-duplicate-credit?',
    });
    expect(
      within(confirm).getByText(/1 fix in 1 new commit, 1 reply, 1 thread resolved/),
    ).toBeDefined();
    expect(publish).not.toHaveBeenCalled();
    fireEvent.click(within(confirm).getByRole('button', { name: 'Push' }));

    await waitFor(() =>
      expect(publish).toHaveBeenCalledWith({
        sessionId: SESSION.id,
        publicationId: 'pub-318',
      }),
    );
    expect(
      await screen.findByText('Pushed a41c9e2, 1 reply posted, 1 thread resolved on GitHub.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Review publication' })).toBeNull();
  });

  it('focuses the first present thread of a selection target and keeps the set', async () => {
    await mount({ threadId: null });
    const selection = ['PRRT_thread_gone', 'PRRT_thread_error_shape', EXPANDED_THREAD_ID];

    await act(async () => {
      await useAppStore.getState().openReviewTarget({
        sessionId: SESSION.id,
        destination: { kind: 'threads', mountId: null, threadIds: selection },
      });
    });
    await settle();

    expect(focusedThread()).toBe('PRRT_thread_error_shape');
    expect(useAppStore.getState().reviewTargets[SESSION.id]).toBeNull();
    expect(useAppStore.getState().reviewSelection[SESSION.id]).toEqual(selection);
  });

  it('shows the selection bar for a batch opened from the Brief without offering to fix them again', async () => {
    await mount({ threadId: null });

    await act(async () => {
      await useAppStore.getState().openReviewTarget({
        sessionId: SESSION.id,
        destination: {
          kind: 'threads',
          mountId: null,
          threadIds: [EXPANDED_THREAD_ID, FAILED_THREAD_ID],
        },
      });
    });
    await settle();

    const bar = screen.getByRole('toolbar', { name: 'Selected comments' });
    expect(within(bar).getByText('2 selected')).toBeDefined();
    expect(within(bar).queryByRole('button', { name: /^Fix / })).toBeNull();
  });
});

describe('Review of a failed run', () => {
  it('says why, shows the last command and offers the retry choices instead of Redraft', async () => {
    await mountFailed({ failure: 'run' });

    const failed = within(comment());
    expect(failed.getByText('The run ended before the resolver reported a result')).toBeDefined();
    expect(failed.getByText(/pnpm test src\/webhooks · 2 failing/)).toBeDefined();
    expect(failed.getByRole('button', { name: /^Retry/ })).toBeDefined();
    expect(failed.getByRole('button', { name: 'Try another model' })).toBeDefined();
    expect(failed.getByRole('button', { name: 'Add a hint' })).toBeDefined();
    expect(failed.queryByRole('button', { name: /Redraft/ })).toBeNull();
    expect(failed.getByText(/^Attempt 1/)).toBeDefined();
  });

  it('retries on the model the reviewer picked and keeps the earlier attempt in one line', async () => {
    const spawnAgent = vi.fn<StoreState['spawnAgent']>(async () => 'agent-retry' as AgentId);
    const setAgentConfig = vi.fn<StoreState['setAgentConfig']>(async () => undefined);
    stub({
      spawnAgent: spawnAgent,
      setAgentConfig: setAgentConfig,
    });
    await mountFailed({ failure: 'history' });
    act(() => {
      useAppStore.getState().setResolveQueueView({
        sessionId: SESSION.id,
        patch: {
          lastRouting: { provider: 'anthropic', model: 'claude-opus-5', effort: 'high' },
        },
      });
    });

    const failed = within(comment());
    expect(failed.getByRole('button', { name: /^Retry on Opus 5/ })).toBeDefined();
    expect(failed.getByRole('button', { name: /Attempt 1 · Sonnet 5/ })).toBeDefined();
    fireEvent.click(failed.getByRole('button', { name: /^Retry on Opus 5/ }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    const args = spawnAgent.mock.calls[0]?.[1];
    expect(args?.model).toBe('claude-opus-5');
    expect(args?.effort).toBe('high');
  });

  it('opens the hint field and sends it with the retry', async () => {
    const spawnAgent = vi.fn<StoreState['spawnAgent']>(async () => 'agent-retry' as AgentId);
    stub({
      spawnAgent: spawnAgent,
      setAgentConfig: vi.fn<StoreState['setAgentConfig']>(async () => undefined),
    });
    await mountFailed({ failure: 'run' });

    fireEvent.click(within(comment()).getByRole('button', { name: 'Add a hint' }));
    const field = await screen.findByRole('textbox', {
      name: 'What should the agent do differently?',
    });
    fireEvent.change(field, { target: { value: 'Use ON CONFLICT' } });
    fireEvent.click(within(comment()).getByRole('button', { name: 'Retry with the hint' }));

    await waitFor(() => expect(spawnAgent).toHaveBeenCalledOnce());
    const args = spawnAgent.mock.calls[0]?.[1];
    expect(args?.initialPrompt).toContain('Use ON CONFLICT');
  });

  it('puts Reply yourself, Skip and Open transcript in the menu', async () => {
    await mountFailed({ failure: 'run' });

    fireEvent.click(within(comment()).getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: /Reply yourself/ })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Skip/ })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /Open transcript/ })).toBeDefined();
  });

  it('asks before syncing a push that failed on a moved remote and stops on a conflict', async () => {
    const syncBranchWithRemote = vi.fn<StoreState['syncBranchWithRemote']>(async () => ({
      kind: 'conflict',
    }));
    stub({
      syncBranchWithRemote: syncBranchWithRemote,
    });
    await mountFailed({ failure: 'run', threadId: 'PRRT_thread_log_redact' });

    const pushed = within(comment());
    expect(pushed.getByText(/^Nothing was pushed\. The branch on origin moved/)).toBeDefined();
    expect(pushed.getByRole('button', { name: 'Push again' })).toBeDefined();
    fireEvent.click(pushed.getByRole('button', { name: 'Sync and try again' }));

    expect(await screen.findByText('Bring the new commits in first?')).toBeDefined();
    expect(syncBranchWithRemote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => expect(syncBranchWithRemote).toHaveBeenCalledOnce());
    expect(await screen.findByText(/conflict with the new ones on origin/)).toBeDefined();
  });
});
