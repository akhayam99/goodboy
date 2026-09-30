// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { PrReviewDraft, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { ToastProvider } from '../../../../../shared/components/Toast';
import { WriteReviewForm } from './WriteReviewForm';

type StoreState = ReturnType<StoryStore['getState']>;

const SESSION_ID = 'session-write-review' as SessionId;

const draftOf = (id: string, path: string, line: number, body: string): PrReviewDraft => ({
  id,
  sessionId: SESSION_ID,
  provider: 'github',
  repo: 'harborline/payments-api',
  prNumber: 318,
  path,
  line,
  startLine: null,
  side: 'new',
  body,
  status: 'draft',
  stale: false,
  origin: 'user',
  createdAt: '2026-09-04T14:00:00.000Z' as PrReviewDraft['createdAt'],
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mount = async (): Promise<void> => {
  render(
    <ToastProvider>
      <WriteReviewForm sessionId={SESSION_ID} />
    </ToastProvider>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
};

describe('Write review as a form', () => {
  it('asks for something to send before an empty comment review', async () => {
    await mount();

    expect(screen.getByRole('button', { name: /^Submit comments/ }).hasAttribute('disabled')).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Approve' }));
    expect(screen.getByRole('button', { name: /^Approve/ }).hasAttribute('disabled')).toBe(false);
  });

  it('lists the line comments, then the verdict and summary, and submits once on the button', async () => {
    const publishPrReview = vi.fn(async () => ({
      published: 2,
      stale: [],
      failed: [],
      mismatched: [],
    }));
    const setPullRequestMode = vi.fn();
    useAppStore.setState({
      reviewDrafts: {
        [SESSION_ID]: [
          draftOf('d1', 'src/ledger/postCredit.ts', 18, 'This could take the transaction.'),
          draftOf('d2', 'src/webhooks/retryPolicy.ts', 55, 'Nit: name the constant.'),
        ],
      },
      publishPrReview: publishPrReview as unknown as StoreState['publishPrReview'],
      loadReviewDrafts: vi.fn(async () => undefined),
      setPullRequestMode: setPullRequestMode as unknown as StoreState['setPullRequestMode'],
    });
    await mount();

    const form = screen.getByRole('region', { name: 'Your review' });
    expect(within(form).getByText('src/ledger/postCredit.ts:18')).toBeDefined();
    fireEvent.click(screen.getByRole('tab', { name: 'Request changes' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Summary' }), {
      target: { value: 'Two small notes.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Request changes/ }));

    await waitFor(() => expect(publishPrReview).toHaveBeenCalledOnce());
    expect(publishPrReview).toHaveBeenCalledWith(SESSION_ID, {
      verdict: 'request_changes',
      body: 'Two small notes.',
    });
    await waitFor(() =>
      expect(setPullRequestMode).toHaveBeenCalledWith({ sessionId: SESSION_ID, mode: 'overview' }),
    );
    expect(document.querySelector('[data-slot="pane-dock"]')).toBeNull();
  });

  it('edits a line comment in place and deletes one with undo', async () => {
    const updateReviewDraft = vi.fn(async () => undefined);
    const discardReviewDraft = vi.fn(async () => undefined);
    useAppStore.setState({
      reviewDrafts: {
        [SESSION_ID]: [draftOf('d1', 'src/ledger/postCredit.ts', 18, 'Take the transaction.')],
      },
      updateReviewDraft: updateReviewDraft as unknown as StoreState['updateReviewDraft'],
      discardReviewDraft: discardReviewDraft as unknown as StoreState['discardReviewDraft'],
    });
    await mount();

    fireEvent.click(screen.getByRole('button', { name: 'Edit comment' }));
    const box = await screen.findByRole('textbox', { name: 'Edit comment' });
    fireEvent.change(box, { target: { value: 'Reuse the caller transaction.' } });
    fireEvent.keyDown(box, { key: 'Enter', code: 'Enter' });
    await waitFor(() =>
      expect(updateReviewDraft).toHaveBeenCalledWith('d1', 'Reuse the caller transaction.'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete comment' }));
    await waitFor(() => expect(discardReviewDraft).toHaveBeenCalledWith('d1'));
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeDefined();
  });
});
