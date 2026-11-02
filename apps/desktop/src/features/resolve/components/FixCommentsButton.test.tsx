// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import {
  CTX_PAYMENTS_MOUNT_ID,
  CTX_SESSION_ID,
} from '../../../app/components/MockScene/scenes/brand/contextBase';
import { seedNotesScene } from '../../../app/components/MockScene/scenes/u23/notesSeed';
import { FixCommentsButton } from './FixCommentsButton';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mountButton = () =>
  render(<FixCommentsButton sessionId={CTX_SESSION_ID} mountId={CTX_PAYMENTS_MOUNT_ID} />);

describe('FixCommentsButton', () => {
  it('counts the open notes that nobody started, with no pull request', () => {
    seedNotesScene({ variant: 'comments-no-pr' });

    mountButton();

    expect(screen.getByRole('button', { name: 'Fix 2 threads' })).toBeDefined();
  });

  it('reads Fixing and is disabled while a run is going', () => {
    seedNotesScene({ variant: 'comments-no-pr' });

    render(
      <FixCommentsButton
        sessionId={CTX_SESSION_ID}
        mountId={CTX_PAYMENTS_MOUNT_ID}
        fixingThreads={4}
      />,
    );

    expect(screen.getByRole('button', { name: 'Fixing 4 threads' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('reads Apply and applies the waiting fixes', () => {
    seedNotesScene({ variant: 'comments-no-pr' });
    const onApply = vi.fn();

    render(
      <FixCommentsButton
        sessionId={CTX_SESSION_ID}
        mountId={CTX_PAYMENTS_MOUNT_ID}
        waitingFixes={3}
        onApply={onApply}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply 3 fixes' }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('reads Push with the commit count and pushes when nothing is left to fix', () => {
    seedNotesScene({ variant: 'comments-no-pr' });
    useAppStore.setState({ diffComments: { [CTX_SESSION_ID]: [] }, sessionResolveQueueItems: {} });
    const onPush = vi.fn();

    render(
      <FixCommentsButton
        sessionId={CTX_SESSION_ID}
        mountId={CTX_PAYMENTS_MOUNT_ID}
        unpushedCommits={3}
        onPush={onPush}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Push 3 commits' }));

    expect(onPush).toHaveBeenCalledTimes(1);
  });

  it('leaves the push to the header and never offers Request review beside it', () => {
    seedNotesScene({ variant: 'comments-no-pr' });
    useAppStore.setState({ diffComments: { [CTX_SESSION_ID]: [] }, sessionResolveQueueItems: {} });

    render(
      <FixCommentsButton
        sessionId={CTX_SESSION_ID}
        mountId={CTX_PAYMENTS_MOUNT_ID}
        unpushedCommits={3}
        onRequestReview={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('reads Request review when every comment is settled and the pull request allows it', () => {
    seedNotesScene({ variant: 'comments-no-pr' });
    useAppStore.setState({ diffComments: { [CTX_SESSION_ID]: [] }, sessionResolveQueueItems: {} });
    const onRequestReview = vi.fn();

    render(
      <FixCommentsButton
        sessionId={CTX_SESSION_ID}
        mountId={CTX_PAYMENTS_MOUNT_ID}
        onRequestReview={onRequestReview}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Request review' }));

    expect(onRequestReview).toHaveBeenCalledTimes(1);
  });

  it('opens the fix comments drawer for the session and its mount', () => {
    seedNotesScene({ variant: 'comments-no-pr' });
    mountButton();

    fireEvent.click(screen.getByRole('button', { name: 'Fix 2 threads' }));

    expect(useAppStore.getState().drawer).toEqual({
      kind: 'fix-comments',
      sessionId: CTX_SESSION_ID,
      payload: { mountId: CTX_PAYMENTS_MOUNT_ID, focusThreadId: null },
    });
  });

  it('is not there when nothing is waiting to be fixed', () => {
    seedNotesScene({ variant: 'comments-no-pr' });
    useAppStore.setState({ diffComments: { [CTX_SESSION_ID]: [] }, sessionResolveQueueItems: {} });

    mountButton();

    expect(screen.queryByRole('button', { name: /^Fix comments/ })).toBeNull();
  });
});
