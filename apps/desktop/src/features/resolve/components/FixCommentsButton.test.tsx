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

    expect(screen.getByRole('button', { name: 'Fix comments 2' })).toBeDefined();
  });

  it('opens the fix comments drawer for the session and its mount', () => {
    seedNotesScene({ variant: 'comments-no-pr' });
    mountButton();

    fireEvent.click(screen.getByRole('button', { name: 'Fix comments 2' }));

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
