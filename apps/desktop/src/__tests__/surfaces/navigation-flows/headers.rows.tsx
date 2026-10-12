import { expect, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentId } from '@goodboy/types';
import { agentPlace } from '../../../store';
import { type Row, WAIT, click, settle, useAppStore } from './harness';
import { SEEDS, group, installComments, openComments } from './comments-words.rows';

const OTHER_AGENT: AgentId = JSON.parse(JSON.stringify('headers-journey-other-agent'));

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
    name: 'headers: Delete session lives in the overflow and confirms in a popover beside it',
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
      const confirm = await screen.findByRole('dialog', { name: /^Delete .+\?$/ }, WAIT);
      expect(confirm.closest('[data-dropdown-portal]')).not.toBeNull();

      within(confirm).getByRole('button', { name: 'Cancel' }).focus();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'More session actions' }),
      );

      await click(screen.getByRole('button', { name: 'More session actions' }));
      await click(await screen.findByRole('menuitem', { name: /Delete session…/ }, WAIT));
      const again = await screen.findByRole('dialog', { name: /^Delete .+\?$/ }, WAIT);
      await click(within(again).getByRole('button', { name: 'Delete session' }));

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
    name: 'headers: opening Push keeps the header Push secondary, yields the header primary, and the confirm pushes once',
    covers: ['navigate'],
    open: async (ctx) => {
      installComments({ sessionId: ctx.sessionId, seeds: SEEDS });
      publish.mockClear();
      useAppStore.setState({ publishConversations: publish });
      await openComments(ctx);
      await click(within(group('Needs you')).getByRole('button', { name: 'Apply 2 fixes' }));
      expect(headerPush().getAttribute('data-variant')).toBe('secondary');
      await click(headerPush());
    },
    lands: async () => {
      const confirm = await screen.findByRole('group', {
        name: 'Push 1 commit to hl/fix-duplicate-credit?',
      });
      expect(headerPush().getAttribute('data-variant')).toBe('secondary');
      expect(
        document.querySelectorAll('[data-slot="header-actions"] button[data-variant="primary"]'),
      ).toHaveLength(0);
      const confirmButton = within(confirm).getByRole('button', { name: 'Push' });
      expect(confirmButton.getAttribute('data-variant')).toBe('primary');
      expect(confirm.querySelector('[data-testid="tone-bar"]')).toBeNull();

      await click(confirmButton);

      await waitFor(() => expect(publish).toHaveBeenCalledTimes(1), WAIT);
      await waitFor(
        () => expect(screen.queryByRole('group', { name: /^Push 1 commit/ })).toBeNull(),
        WAIT,
      );
    },
  },
  {
    name: 'agent page: opens on the Brief from a door when it has content, and the tab picked by hand is remembered for that agent only',
    covers: ['navigate'],
    open: async (ctx) => {
      const agents = (useAppStore.getState().sessionPhaseRuns[ctx.sessionId] ?? []).filter(
        (candidate) => candidate.workflowRunId == null && candidate.deletedAt == null,
      );
      const first = agents[0];
      if (first === undefined) {
        throw new Error('the seeded session has no standalone agent');
      }
      useAppStore.setState((current) => ({
        sessionPhaseRuns: {
          ...current.sessionPhaseRuns,
          [ctx.sessionId]: [
            ...(current.sessionPhaseRuns[ctx.sessionId] ?? []).map((run) =>
              run.id === first.id ? { ...run, outputSummary: 'Capped the retries at three' } : run,
            ),
            {
              ...first,
              outputSummary: 'Capped the retries at three',
              id: OTHER_AGENT,
              name: 'Review the retry cap',
              kind: 'reviewer',
            },
          ],
        },
      }));
      useAppStore
        .getState()
        .navigate({ to: agentPlace({ sessionId: ctx.sessionId, agentId: first.id }) });
      await settle();
    },
    lands: async (ctx) => {
      const state = () => useAppStore.getState();
      const first = state().selectedAgentId[ctx.sessionId];
      if (first == null) {
        throw new Error('no agent opened');
      }
      const tab = (name: string) => screen.findByRole('tab', { name }, WAIT);
      expect((await tab('Brief')).getAttribute('aria-selected')).toBe('true');

      await click(await tab('Transcript'));
      expect(state().agentTab[first]).toBe('transcript');

      state().navigate({
        to: {
          at: 'session',
          sessionId: ctx.sessionId,
          view: { lens: null, agentId: null, studio: null, target: null },
        },
      });
      await settle();
      state().navigate({ to: agentPlace({ sessionId: ctx.sessionId, agentId: first }) });
      await settle();
      await waitFor(
        async () => expect((await tab('Transcript')).getAttribute('aria-selected')).toBe('true'),
        WAIT,
      );

      state().navigate({ to: agentPlace({ sessionId: ctx.sessionId, agentId: OTHER_AGENT }) });
      await settle();
      await waitFor(
        async () => expect((await tab('Brief')).getAttribute('aria-selected')).toBe('true'),
        WAIT,
      );
    },
  },
];
