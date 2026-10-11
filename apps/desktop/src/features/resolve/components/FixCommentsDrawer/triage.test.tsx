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
import { SESSION } from '../../../../app/components/MockScene/scenes/resolveSeed';
import {
  commentsTriageSeed,
  type CommentsTriagePhase,
} from '../../../../app/components/MockScene/scenes/u24/commentsTriageSeed';
import { FixCommentsDrawer } from '.';

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

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async ({ phase }: { readonly phase: CommentsTriagePhase }): Promise<void> => {
  commentsTriageSeed({ phase });
  render(
    <ToastProvider>
      <FixCommentsDrawer
        sessionId={SESSION.id}
        focusThreadId={null}
        threadIds={[]}
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );
  await settle();
};

const drawer = (): HTMLElement => screen.getByRole('region', { name: 'Fix comments' });

const firstApply = (): HTMLElement => {
  const [first] = within(drawer()).getAllByRole('button', { name: 'Apply fix' });
  if (first === undefined) {
    throw new Error('No Apply fix button');
  }
  return first;
};

const approve = ({ threadId }: { readonly threadId: string }): void => {
  useAppStore.setState((state) => ({
    sessionResolveQueueItems: {
      ...state.sessionResolveQueueItems,
      [SESSION.id]: (state.sessionResolveQueueItems[SESSION.id] ?? []).map((entry) =>
        entry.thread.threadId === threadId
          ? {
              item: { ...entry.item, approvalState: 'accepted' as const },
              thread: { ...entry.thread, stage: 'approved' as const, commitShas: ['9e4c1a7f0d'] },
            }
          : entry,
      ),
    },
  }));
};

describe('the triage outcomes in the Fix comments drawer', () => {
  it('shows the four outcomes of a mixed analysis with their verbs', async () => {
    await mount({ phase: 'mixed' });

    const view = within(drawer());
    expect(view.getAllByRole('button', { name: 'Apply fix' })).toHaveLength(2);
    expect(view.getAllByRole('button', { name: 'Discard' })).toHaveLength(2);
    expect(view.getByRole('button', { name: 'Answer' })).toBeDefined();
    expect(view.getByRole('button', { name: 'Ask on GitHub' })).toBeDefined();
    expect(view.getByRole('button', { name: 'Post reply' })).toBeDefined();
    expect(view.getByRole('button', { name: 'Resolve without reply' })).toBeDefined();
    expect(view.getByRole('button', { name: 'Close note' })).toBeDefined();
    expect(view.getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(view.getByText('It conflicts with a fix you accepted before')).toBeDefined();
  });
});

const spyAccept = (): ReturnType<typeof vi.fn<StoreState['acceptResolveQueueItem']>> => {
  const accept = vi.fn<StoreState['acceptResolveQueueItem']>(async ({ itemId }) => {
    const entry = (useAppStore.getState().sessionResolveQueueItems[SESSION.id] ?? []).find(
      (candidate) => candidate.item.id === itemId,
    );
    if (entry !== undefined) {
      approve({ threadId: entry.thread.threadId });
    }
  });
  useAppStore.setState({ acceptResolveQueueItem: accept });
  return accept;
};

describe('the triage actions', () => {
  it('applies one fix through acceptResolveQueueItem and the row becomes Fixed', async () => {
    const accept = spyAccept();
    await mount({ phase: 'mixed' });

    fireEvent.click(firstApply());

    await waitFor(() => expect(accept).toHaveBeenCalledOnce());
    expect(accept.mock.calls[0]?.[0].itemId).toBe('mock-bulk-item-r1');
    await waitFor(() => expect(within(drawer()).getByText('Fixed in 9e4c1a7')).toBeDefined());
  });

  it('answers a question through answerQuestions without spawning anything', async () => {
    const answer = vi.fn<StoreState['answerQuestions']>(async () => undefined);
    const spawnAgent = vi.fn<StoreState['spawnAgent']>();
    useAppStore.setState({ answerQuestions: answer, spawnAgent });
    await mount({ phase: 'question' });

    fireEvent.change(within(drawer()).getByRole('textbox', { name: 'Your answer' }), {
      target: { value: 'Keep the one in retryPolicy.ts' },
    });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Answer' }));

    await waitFor(() => expect(answer).toHaveBeenCalledOnce());
    expect(answer.mock.calls[0]?.[0]).toMatchObject({
      sessionId: SESSION.id,
      launchId: 'mock-bulk-launch',
      answers: [{ threadId: 'PRRT_bulk_r5', answer: 'Keep the one in retryPolicy.ts' }],
    });
    expect(spawnAgent).not.toHaveBeenCalled();
  });

  it('posts a reply through publishThreadNow', async () => {
    const accept = spyAccept();
    const publish = vi.fn<StoreState['publishThreadNow']>(async () => undefined);
    useAppStore.setState({ publishThreadNow: publish });
    await mount({ phase: 'mixed' });

    fireEvent.click(within(drawer()).getByRole('button', { name: 'Post reply' }));

    await waitFor(() => expect(publish).toHaveBeenCalledOnce());
    expect(accept).toHaveBeenCalledOnce();
    expect(publish.mock.calls[0]?.[0]).toEqual({ sessionId: SESSION.id, threadId: 'PRRT_bulk_r2' });
  });

  it('closes a local note with Close note', async () => {
    const close = vi.fn<StoreState['closeResolvedNote']>(async () => undefined);
    useAppStore.setState({ closeResolvedNote: close });
    await mount({ phase: 'mixed' });

    fireEvent.click(within(drawer()).getByRole('button', { name: 'Close note' }));

    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(close.mock.calls[0]?.[0].threadId).toBe('note:mock-note-triage-cap');
  });

  it('applies every fix from the batch row with one call per fix', async () => {
    const accept = spyAccept();
    await mount({ phase: 'mixed' });

    fireEvent.click(within(drawer()).getByRole('button', { name: 'Apply 2 fixes' }));

    await waitFor(() => expect(accept).toHaveBeenCalledTimes(2));
  });

  it('keeps one top row for the resolver after an apply and an answer', async () => {
    spyAccept();
    useAppStore.setState({
      answerQuestions: vi.fn<StoreState['answerQuestions']>(async () => undefined),
    });
    await mount({ phase: 'mixed' });
    const before = within(drawer()).getAllByRole('button', { name: /^Open agent/ }).length;

    fireEvent.click(firstApply());
    await waitFor(() => expect(within(drawer()).getByText('Fixed in 9e4c1a7')).toBeDefined());
    fireEvent.change(within(drawer()).getByRole('textbox', { name: 'Your answer' }), {
      target: { value: 'config.ts' },
    });
    fireEvent.click(within(drawer()).getByRole('button', { name: 'Answer' }));
    await settle();

    expect(before).toBe(1);
    expect(within(drawer()).getAllByRole('button', { name: /^Open agent/ })).toHaveLength(1);
  });
});
