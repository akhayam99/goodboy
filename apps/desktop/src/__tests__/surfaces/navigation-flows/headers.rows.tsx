import { expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Row, WAIT, click, settle, useAppStore } from './harness';
import { SEEDS, group, installComments, openComments } from './comments-words.rows';

const publish = vi.fn(async () => ({
  kind: 'done' as const,
  pushed: true,
  pushedHead: 'a41c9e2aaaa',
  total: 2,
  replies: 2,
  replied: 2,
  closed: 2,
  resolved: 2,
  leftOpen: 0,
  failed: 0,
  error: null,
}));

const headerPush = (): HTMLElement => {
  const button = screen
    .getAllByRole('button', { name: /^Push 2/ })
    .find((candidate) => candidate.closest('[role="navigation"]') === null);
  if (button === undefined) {
    throw new Error('the header has no Push button');
  }
  return button;
};

export const HEADERS_ROWS: ReadonlyArray<Row> = [
  {
    name: 'headers: Delete session lives in the overflow and confirms inline under the title row',
    covers: [],
    open: async () => {
      await settle();
      expect(screen.queryByRole('button', { name: 'Delete session' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Archive session' })).toBeNull();
      await click(await screen.findByRole('button', { name: 'More session actions' }, WAIT));
      await click(await screen.findByRole('menuitem', { name: /Delete session…/ }, WAIT));
    },
    lands: async (ctx) => {
      const deleteTask = vi.fn(async () => {
        useAppStore.setState({
          sessions: useAppStore
            .getState()
            .sessions.filter((session) => session.id !== ctx.sessionId),
        });
      });
      useAppStore.setState({ deleteTask });
      const confirm = await screen.findByRole('group', { name: 'Delete session?' }, WAIT);
      expect(screen.queryByRole('dialog')).toBeNull();

      within(confirm).getByRole('button', { name: 'Cancel' }).focus();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('group', { name: 'Delete session?' })).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'More session actions' }),
      );

      await click(screen.getByRole('button', { name: 'More session actions' }));
      await click(await screen.findByRole('menuitem', { name: /Delete session…/ }, WAIT));
      const again = await screen.findByRole('group', { name: 'Delete session?' }, WAIT);
      await click(within(again).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(deleteTask).toHaveBeenCalledTimes(1), WAIT);
      expect(deleteTask).toHaveBeenCalledWith(ctx.sessionId);
      await waitFor(
        () =>
          expect(
            useAppStore.getState().sessions.some((session) => session.id === ctx.sessionId),
          ).toBe(false),
        WAIT,
      );
    },
  },
  {
    name: 'headers: opening Push turns the header primary secondary and the confirm pushes once',
    covers: ['navigate'],
    open: async (ctx) => {
      installComments({ sessionId: ctx.sessionId, seeds: SEEDS });
      publish.mockClear();
      useAppStore.setState({ publishConversations: publish });
      await openComments(ctx);
      await click(within(group('Needs you')).getByRole('button', { name: 'Accept 2' }));
      expect(headerPush().getAttribute('data-variant')).toBe('primary');
      await click(headerPush());
    },
    lands: async () => {
      const confirm = await screen.findByRole('group', {
        name: 'Push 1 commit to hl/fix-duplicate-credit?',
      });
      expect(headerPush().getAttribute('data-variant')).toBe('secondary');
      const confirmButton = within(confirm).getByRole('button', { name: 'Push' });
      expect(confirmButton.getAttribute('data-variant')).toBe('primary');
      expect(confirm.querySelector('[data-testid="tone-bar"]')).not.toBeNull();

      await click(confirmButton);

      await waitFor(() => expect(publish).toHaveBeenCalledTimes(1), WAIT);
      await waitFor(
        () => expect(screen.queryByRole('group', { name: /^Push 1 commit/ })).toBeNull(),
        WAIT,
      );
    },
  },
];
