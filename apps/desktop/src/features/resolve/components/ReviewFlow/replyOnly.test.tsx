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
  THREAD_IDS,
  seedResolveScene,
  type ReplyOnlyVariant,
} from '../../../../app/components/MockScene/scenes/resolveSeed';
import { BranchPage } from '../../../branch/components/BranchPage';

type StoreState = ReturnType<StoryStore['getState']>;

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

const mountReply = async ({
  variant,
  threadId = THREAD_IDS.retryConstant,
}: {
  readonly variant?: ReplyOnlyVariant;
  readonly threadId?: string;
}): Promise<void> => {
  seedResolveScene({
    expandedThreadId: threadId,
    ...(variant !== undefined && { replyOnly: variant }),
  });
  render(
    <ToastProvider>
      <BranchPage session={SESSION} workingDir={null} />
    </ToastProvider>,
  );
  await settle();
};

const comment = (): HTMLElement => screen.getByRole('article', { name: 'Comment' });

const bar = (): HTMLElement => screen.getByRole('toolbar', { name: 'Comment actions' });

const openMenuItem = async (name: RegExp): Promise<void> => {
  fireEvent.click(within(bar()).getByRole('button', { name: 'More actions' }));
  fireEvent.click(await screen.findByRole('menuitem', { name }));
};

describe('a reply-only answer in the thread', () => {
  it('keeps the reply with the push while a fix waits, and offers Publish reply', async () => {
    await mountReply({ variant: 'bundled' });

    expect(
      within(comment()).getByText('Reply only. It goes out with the next push. No code change.'),
    ).toBeDefined();
    expect(within(comment()).getByRole('button', { name: 'Publish reply' })).toBeDefined();
  });

  it('says nothing else is waiting when no fix is left to push, and still offers Publish reply', async () => {
    await mountReply({ variant: 'alone' });

    expect(
      within(comment()).getByText(
        'Reply only. Nothing else is waiting to push, so it can go out now.',
      ),
    ).toBeDefined();
    expect(within(comment()).getByRole('button', { name: 'Publish reply' })).toBeDefined();
  });

  it('posts the one thread when Publish reply is pressed', async () => {
    const publishThreadNow = vi.fn(async () => undefined);
    stub({ publishThreadNow });
    await mountReply({ variant: 'bundled' });

    fireEvent.click(within(comment()).getByRole('button', { name: 'Publish reply' }));

    await waitFor(() =>
      expect(publishThreadNow).toHaveBeenCalledWith({
        sessionId: SESSION.id,
        threadId: THREAD_IDS.retryConstant,
      }),
    );
  });

  it('shows a failed post inline and offers Retry', async () => {
    const publishThreadNow = vi.fn(async () => {
      throw new Error('GitHub did not answer');
    });
    stub({ publishThreadNow });
    await mountReply({ variant: 'alone' });

    fireEvent.click(within(comment()).getByRole('button', { name: 'Publish reply' }));

    const alert = await within(comment()).findByRole('alert');
    expect(alert.textContent).toContain('GitHub did not answer');
    expect(within(comment()).getByRole('button', { name: 'Retry' })).toBeDefined();
    expect(within(comment()).queryByRole('button', { name: 'Publish reply' })).toBeNull();
  });

  it('reads as replied on GitHub, with a link to the comment, once it is posted', async () => {
    await mountReply({ variant: 'posted' });

    expect(within(comment()).getByText('Replied on GitHub.')).toBeDefined();
    expect(within(comment()).getByRole('button', { name: 'View on GitHub' })).toBeDefined();
    expect(within(comment()).queryByRole('button', { name: 'Publish reply' })).toBeNull();
    expect(within(comment()).queryByRole('button', { name: 'Rewrite reply' })).toBeNull();
  });
});

describe('steering the answer in place', () => {
  it('opens a hint field for Rewrite reply, sends it with no hint required, and closes on Escape', async () => {
    await mountReply({ variant: 'alone' });

    await openMenuItem(/^Rewrite reply/);

    const field = within(comment()).getByRole('textbox', { name: 'How the reply should change' });
    expect(document.activeElement).toBe(field);
    const send = within(comment()).getByRole('button', { name: 'Rewrite the reply' });
    expect((send as HTMLButtonElement).disabled).toBe(false);

    fireEvent.keyDown(field, { key: 'Escape', code: 'Escape' });

    expect(
      within(comment()).queryByRole('textbox', { name: 'How the reply should change' }),
    ).toBeNull();
    expect(within(bar()).getByRole('button', { name: 'More actions' })).toBeDefined();
  });

  it('opens a hint field for Fix it anyway on a no-change answer', async () => {
    await mountReply({ variant: 'alone' });

    await openMenuItem(/^Fix it anyway/);

    expect(
      within(comment()).getByRole('textbox', { name: 'What the fix should do' }),
    ).toBeDefined();
    expect(within(comment()).getByRole('button', { name: 'Fix it anyway' })).toBeDefined();
  });

  it('offers Reply only on a fix, and switches the thread when pressed', async () => {
    const switchToReplyOnly = vi.fn(async () => undefined);
    stub({ switchToReplyOnly });
    await mountReply({ threadId: EXPANDED_THREAD_ID });

    expect(within(bar()).queryByRole('button', { name: 'Fix it anyway' })).toBeNull();
    fireEvent.click(within(bar()).getByRole('button', { name: /^Reply only/ }));

    await waitFor(() =>
      expect(switchToReplyOnly).toHaveBeenCalledWith({
        sessionId: SESSION.id,
        threadId: EXPANDED_THREAD_ID,
      }),
    );
  });

  it('lets the owner edit an accepted reply by hand before it goes out', async () => {
    await mountReply({ variant: 'bundled' });

    fireEvent.click(within(bar()).getByRole('button', { name: 'More actions' }));
    expect(await screen.findByRole('menuitem', { name: /^Edit reply/ })).toBeDefined();
  });
});
