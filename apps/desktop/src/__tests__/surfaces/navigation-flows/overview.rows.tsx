import { expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import { openQuestionFor } from '../../../features/workspace/testing/sessionColumn';
import { mountGridTracksOf } from '../../../features/session/components/SessionOverviewPane/ProjectMountRows/mountGrid';
import { type Ctx, type Row, WAIT, click, clickButton, lens, settle, useAppStore } from './harness';

const REOPEN_FAILURE = 'fatal: the worktree path is already registered by another process';

const closeFirstMount = ({ sessionId }: Ctx): void => {
  const state = useAppStore.getState();
  const mounts = state.sessionProjectMounts[sessionId] ?? [];
  const [first] = mounts;
  if (first === undefined) {
    throw new Error('the board seed has no mount to close');
  }
  const closed = { ...first, isAttached: false };
  useAppStore.setState({
    sessionProjectMounts: {
      ...state.sessionProjectMounts,
      [sessionId]: [closed, ...mounts.slice(1)],
    },
    sessionMounts: {
      ...state.sessionMounts,
      [sessionId]: (state.sessionMounts[sessionId] ?? []).map((view) =>
        view.id === first.mountId ? { ...view, isAttached: false, worktreePath: null } : view,
      ),
    },
  });
};

const attachAttempts: Array<string> = [];

const failReopenOnce = ({ sessionId }: Ctx): void => {
  attachAttempts.length = 0;
  const mountView = useAppStore.getState().sessionMounts[sessionId]?.[0];
  if (mountView === undefined) {
    throw new Error('the board seed has no mount view');
  }
  useAppStore.setState({
    attachMount: async ({ mountId }) => {
      attachAttempts.push(mountId);
      if (attachAttempts.length === 1) {
        throw new Error(REOPEN_FAILURE);
      }
      return mountView;
    },
  });
};

const reopenButton = (): Promise<HTMLElement> =>
  screen.findByRole('button', { name: /^Reopen for / }, WAIT);

export const OVERVIEW_ROWS: ReadonlyArray<Row> = [
  {
    name: 'overview: a mount that fails to reopen raises a notice with Retry and keeps its row',
    covers: ['overview:mount-failure'],
    open: async (ctx) => {
      closeFirstMount(ctx);
      failReopenOnce(ctx);
      await settle();
      await screen.findByRole('region', { name: 'Projects' }, WAIT);
      await click(await reopenButton());
    },
    lands: async () => {
      const notice = await screen.findByRole('alert', {}, WAIT);
      expect(notice.textContent).toMatch(/^Couldn't reopen /);
      const row = notice.closest('[data-testid="project-mount-row"]');
      expect(row).not.toBeNull();
      const cells = row?.querySelector<HTMLElement>('[data-testid="project-mount-cells"]');
      expect(cells?.contains(notice)).toBe(false);
      expect(cells?.getAttribute('data-row-height')).toBe('36');
      const grid = row?.closest('[data-mount-grid]');
      expect(grid?.getAttribute('data-mount-grid')).toBe(mountGridTracksOf().join(' '));

      await click(within(notice).getByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(attachAttempts).toHaveLength(2), WAIT);
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull(), WAIT);
    },
  },
  {
    name: 'overview: a waiting question is answered from the Needs you card only',
    covers: ['overview:needs-you-only'],
    open: async (ctx) => {
      useAppStore.setState({
        sessionOpenQuestions: {
          [ctx.sessionId]: [openQuestionFor({ sessionId: ctx.sessionId as SessionId })],
        },
      });
      await settle();
    },
    lands: async (ctx) => {
      const card = await screen.findByRole('region', { name: 'Needs you' }, WAIT);
      const activity = screen.getByRole('region', { name: 'Activity' });
      expect(within(activity).queryAllByRole('button', { name: 'Answer' })).toHaveLength(0);
      expect(within(card).getAllByRole('button', { name: /^Open/ })).toHaveLength(1);

      await clickButton(/^Open: /);

      await lens('questions')(ctx);
    },
  },
];
