// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import type { IsoDateTime, PrReviewDraft } from '@goodboy/types';
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
  NOTES,
  seedResolveGitlabScene,
} from '../../../../app/components/MockScene/scenes/resolveGitlabSeed';
import type { AddReviewDraftInput } from '../../../../store/slices/review-drafts/addReviewDraft';
import { BranchPage } from '../../../branch/components/BranchPage';

type StoreState = ReturnType<StoryStore['getState']>;

const draftFor = (input: AddReviewDraftInput): PrReviewDraft => ({
  id: 'draft-1',
  sessionId: input.sessionId,
  provider: 'github',
  repo: 'harborline/payments-api',
  prNumber: 318,
  path: input.path,
  line: input.line,
  startLine: null,
  side: 'new',
  body: input.body,
  status: 'draft',
  stale: false,
  origin: 'user',
  createdAt: '2026-10-10T09:00:00.000Z' as IsoDateTime,
});

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const mount = async (): Promise<void> => {
  seedResolveGitlabScene({ selected: 'github' });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await settle();
  fireEvent.click(screen.getByRole('tab', { name: /^Notes/ }));
};

describe('a note in Comments', () => {
  it('offers Post to GitHub and Delete under the note, and neither under a host comment', async () => {
    await mount();
    const row = screen
      .getAllByRole('button')
      .find((button) => button.hasAttribute('data-thread-id'));
    fireEvent.click(row as HTMLElement);

    expect(screen.getByRole('button', { name: 'Post to GitHub' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: /^On GitHub/ }));
    const hostRow = screen
      .getAllByRole('button')
      .find((button) => button.hasAttribute('data-thread-id'));
    fireEvent.click(hostRow as HTMLElement);

    expect(screen.queryByRole('button', { name: 'Post to GitHub' })).toBeNull();
  });

  it('moves the note into the review draft of the pull request and closes it', async () => {
    const addReviewDraft = vi.fn<StoreState['addReviewDraft']>(async (input) => draftFor(input));
    const closeResolvedNote = vi.fn<StoreState['closeResolvedNote']>(async () => undefined);
    await mount();
    useAppStore.setState({ addReviewDraft, closeResolvedNote });
    const row = screen
      .getAllByRole('button')
      .find((button) => button.hasAttribute('data-thread-id'));
    fireEvent.click(row as HTMLElement);

    fireEvent.click(screen.getByRole('button', { name: 'Post to GitHub' }));

    await waitFor(() => expect(addReviewDraft).toHaveBeenCalledTimes(1));
    const draft = addReviewDraft.mock.calls[0]?.[0];
    expect(NOTES.some((note) => note.filePath === draft?.path && note.body === draft?.body)).toBe(
      true,
    );
    await waitFor(() => expect(closeResolvedNote).toHaveBeenCalledTimes(1));
  });

  it('deletes the note it sits under', async () => {
    const discardDiffComments = vi.fn<StoreState['discardDiffComments']>(async () => undefined);
    await mount();
    useAppStore.setState({ discardDiffComments });
    const row = screen
      .getAllByRole('button')
      .find((button) => button.hasAttribute('data-thread-id'));
    fireEvent.click(row as HTMLElement);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(discardDiffComments).toHaveBeenCalledWith({
        sessionId: SESSION.id,
        ids: [expect.stringMatching(/^mock-note-/)],
      }),
    );
  });

  it('puts the kind and the age on each row, and Fix comments in the section header', async () => {
    await mount();

    const list = screen.getByRole('navigation', { name: 'Comments' });
    expect(within(list).getAllByText('Note').length).toBe(NOTES.length);
    expect(screen.getAllByRole('button', { name: /^Fix comments/ })).toHaveLength(1);
  });
});
