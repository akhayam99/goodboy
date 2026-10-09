// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import {
  CTX_PAYMENTS_WORKTREE,
  CTX_SESSION_ID,
} from '../../../../../app/components/MockScene/scenes/brand/contextBase';
import { NOTE_IDS } from '../../../../../app/components/MockScene/scenes/resolveNotesSeed';
import { seedNotesScene } from '../../../../../app/components/MockScene/scenes/u23/notesSeed';
import { noteThreadId } from '../../noteThread';
import { ReviewNotesDrawer } from '.';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  seedNotesScene({ variant: 'all' });
});

afterEach(cleanup);

const renderDrawer = () =>
  render(
    <ToastProvider>
      <ReviewNotesDrawer
        sessionId={CTX_SESSION_ID}
        mountPath={CTX_PAYMENTS_WORKTREE}
        focusPath={null}
        focusThreadId={null}
        onClose={vi.fn()}
      />
    </ToastProvider>,
  );

const noteCard = ({
  panel,
  body,
}: {
  readonly panel: HTMLElement;
  readonly body: RegExp;
}): HTMLElement => {
  const text = within(panel).getByText(body);
  const card = text.closest('[data-note-thread]');
  if (!(card instanceof HTMLElement)) {
    throw new Error('the note is not in a drawer item');
  }
  return card;
};

describe('the review notes drawer by lane state', () => {
  it('lists six open notes by file and keeps the closed one out until Show closed', async () => {
    renderDrawer();

    const panel = await screen.findByRole('region', { name: 'Your notes' });
    expect(within(panel).getByText('6 open')).toBeDefined();
    expect(within(panel).queryByText(/Redact the signing token/)).toBeNull();
    expect(
      within(panel).getByRole('region', { name: 'src/webhooks/applyWebhook.ts' }),
    ).toBeDefined();
    expect(within(panel).getByRole('region', { name: 'src/ledger/postCredit.ts' })).toBeDefined();
  });

  it('keeps every note of a selectable list on one left edge, with or without its checkbox', async () => {
    renderDrawer();

    const panel = await screen.findByRole('region', { name: 'Your notes' });
    const items = panel.querySelectorAll<HTMLElement>('[data-note-thread]');
    expect(items).toHaveLength(6);
    expect(
      within(panel).getAllByRole('checkbox', { name: 'Include in the fix' }).length,
    ).toBeLessThan(6);
    items.forEach((item) => expect(item.className).toContain('pl-7'));
  });

  it('offers Fix, Close and Delete on an open note', async () => {
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });

    const card = noteCard({ panel, body: /Cap the backoff at 30 seconds/ });

    expect(within(card).getByText('Open note')).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Fix' })).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Close' })).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Delete' })).toBeDefined();
    expect(within(card).queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('closes an open note through the lane, the way Comments closes one', async () => {
    const closeResolvedNote = vi.fn(async () => undefined);
    useAppStore.setState({ closeResolvedNote });
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });
    const card = noteCard({ panel, body: /Cap the backoff at 30 seconds/ });

    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Close' }));
    });

    expect(closeResolvedNote).toHaveBeenCalledWith({
      sessionId: CTX_SESSION_ID,
      threadId: noteThreadId({ noteId: 'mock-note-backoff-cap' }),
    });
  });

  it('shows a working note with its run and no reply actions', async () => {
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });

    const card = noteCard({ panel, body: /Log the retry count once/ });

    expect(within(card).getByText('Working on it', { exact: false })).toBeDefined();
    expect(within(card).queryByRole('button', { name: 'Reply' })).toBeNull();
  });

  it('answers a run question inline and continues the same run', async () => {
    const answerQuestions = vi.fn(async () => undefined);
    useAppStore.setState({ answerQuestions });
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });
    const card = noteCard({ panel, body: /Should refunds above the original charge/ });

    fireEvent.change(within(card).getByLabelText('Or tell it something else'), {
      target: { value: 'Reject it in the API layer' },
    });
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Continue the fix run' }));
    });

    expect(answerQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: CTX_SESSION_ID,
        answers: [
          {
            threadId: noteThreadId({ noteId: 'mock-note-refund-limit' }),
            answer: 'Reject it in the API layer',
          },
        ],
      }),
    );
  });

  it('accepts a ready note, skips it, or closes it without a change', async () => {
    const acceptResolveQueueItem = vi.fn(async () => undefined);
    const deferResolveQueueItem = vi.fn(async () => undefined);
    const closeResolvedNote = vi.fn(async () => undefined);
    useAppStore.setState({ acceptResolveQueueItem, deferResolveQueueItem, closeResolvedNote });
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });
    const card = noteCard({ panel, body: /Rename amt to amountMinor/ });

    expect(within(card).getByText('To review')).toBeDefined();
    expect(within(card).queryByRole('button', { name: 'Reply' })).toBeNull();
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Accept' }));
    });
    expect(acceptResolveQueueItem).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 'mock-note-item-mock-note-amount-minor' }),
    );
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Skip' }));
    });
    expect(deferResolveQueueItem).toHaveBeenCalledWith({
      sessionId: CTX_SESSION_ID,
      itemId: 'mock-note-item-mock-note-amount-minor',
    });
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: 'Close the note' }));
    });
    expect(closeResolvedNote).toHaveBeenCalledWith({
      sessionId: CTX_SESSION_ID,
      threadId: noteThreadId({ noteId: 'mock-note-amount-minor' }),
    });
  });

  it('retries a note that could not be fixed in the same run', async () => {
    const retryCouldntFix = vi.fn(async () => undefined);
    useAppStore.setState({ retryCouldntFix });
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });
    const card = noteCard({ panel, body: /Use the shared retry helper/ });

    expect(within(card).getAllByText("Couldn't fix").length).toBeGreaterThan(0);
    await act(async () => {
      fireEvent.click(within(card).getByRole('button', { name: /^Retry/ }));
    });

    expect(retryCouldntFix).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: CTX_SESSION_ID,
        threadIds: [noteThreadId({ noteId: 'mock-note-shared-retry' })],
      }),
    );
  });

  it('drops a state filter once no note is in that state, so the rest of the notes stay in view', async () => {
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });
    fireEvent.click(within(panel).getByRole('button', { name: /1 working/ }));
    expect(within(panel).queryByText(/Cap the backoff/)).toBeNull();

    act(() => {
      useAppStore.setState((state) => ({
        diffComments: {
          ...state.diffComments,
          [CTX_SESSION_ID]: (state.diffComments[CTX_SESSION_ID] ?? []).filter(
            (note) => note.id !== NOTE_IDS.working,
          ),
        },
        sessionResolveQueueItems: {
          ...state.sessionResolveQueueItems,
          [CTX_SESSION_ID]: (state.sessionResolveQueueItems[CTX_SESSION_ID] ?? []).filter(
            (entry) => entry.thread.diffCommentId !== NOTE_IDS.working,
          ),
        },
      }));
    });

    expect(within(panel).queryByRole('button', { name: /working/ })).toBeNull();
    expect(within(panel).queryByText('No notes')).toBeNull();
    expect(within(panel).getByText(/Cap the backoff/)).toBeDefined();
  });

  it('names the jump by what it does, the file, even for a note on a line', async () => {
    renderDrawer();
    const panel = await screen.findByRole('region', { name: 'Your notes' });
    const card = noteCard({ panel, body: /Cap the backoff/ });

    expect(within(card).getByRole('button', { name: 'Jump to file' })).toBeDefined();
    expect(within(panel).queryByRole('button', { name: 'Jump to line' })).toBeNull();
  });
});
