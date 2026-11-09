// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => null) }));
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import type { WorktreeStatus } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { sessionPlace } from '../../../store/slices/navigation/place';
import {
  refreshWorktreeStatuses,
  resetWorktreeStatusCache,
} from '../../../store/runtime/worktreeStatuses/cache';
import { ToastProvider } from '../../../shared/components/Toast';
import { worktreeStatusOf } from '../../../test/worktreeStatusOf';
import {
  ledgerCore,
  mountGithubOf,
  mountOf,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../features/workspace/testing/sessionColumn';
import { ObjectMenuProvider } from '../../../features/actions/components/ObjectMenuProvider';
import { SessionRail } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  localStorage.clear();
});

afterEach(cleanup);

const session = sessionOf({
  goal: 'Stop retried webhooks',
  lastOpenedAt: '2026-10-06T09:00:00.000Z',
});
const sessionId = session.id;
const paymentsMount = mountOf({ session, project: paymentsApi });
const ledgerMount = mountOf({ session, project: ledgerCore });

type StatusArgs = {
  readonly worktreePath: string;
};

type Answer = (status: WorktreeStatus) => void;

const waiting = new Map<string, Array<Answer>>();

const seedSlowStatuses = () => {
  waiting.clear();
  seedColumn({
    store: useAppStore,
    sessions: [session],
    currentSessionId: sessionId,
    mounts: [[session, paymentsApi]],
  });
  useAppStore.setState({
    sessionBranches: { [sessionId]: paymentsMount.branch },
    sessionProjectMounts: { [sessionId]: [paymentsMount, ledgerMount] },
    mountGithub: {
      [paymentsMount.mountId]: mountGithubOf({ mount: paymentsMount, number: 418 }),
      [ledgerMount.mountId]: mountGithubOf({ mount: ledgerMount, number: 77 }),
    },
  });
  useAppStore.getState().navigate({ to: sessionPlace({ sessionId }) });
  stubStoryInvoke({
    worktree_status: ({ worktreePath }: StatusArgs) =>
      new Promise<WorktreeStatus>((resolve) => {
        waiting.set(worktreePath, [...(waiting.get(worktreePath) ?? []), resolve]);
      }),
    worktree_remote_url: () => 'git@github.com:harborline/payments-api.git',
    detect_editors: () => [],
  });
};

const MICROTASK_TURNS = 50;

const settle = async (): Promise<void> => {
  await act(async () => {
    await Array.from({ length: MICROTASK_TURNS }).reduce<Promise<void>>(
      (previous) => previous.then(() => new Promise<void>((resolve) => queueMicrotask(resolve))),
      Promise.resolve(),
    );
  });
};

const bothAsked = async (): Promise<void> => {
  await waitFor(() => {
    expect(waiting.has(paymentsMount.worktreePath)).toBe(true);
    expect(waiting.has(ledgerMount.worktreePath)).toBe(true);
  });
};

type AnswerParams = {
  readonly worktreePath: string;
  readonly behind: number;
};

const answer = async ({ worktreePath, behind }: AnswerParams): Promise<void> => {
  const answers = waiting.get(worktreePath) ?? [];
  expect(answers.length).toBeGreaterThan(0);
  waiting.delete(worktreePath);
  answers.forEach((resolve) => resolve(worktreeStatusOf({ behind })));
  await settle();
};

const mountRail = async (): Promise<void> => {
  render(
    <ToastProvider>
      <ObjectMenuProvider>
        <SessionRail session={session} />
      </ObjectMenuProvider>
    </ToastProvider>,
  );
  await bothAsked();
  await settle();
};

const chipText = (project: string, name: RegExp): string | null =>
  within(
    within(screen.getByRole('list', { name: `${project} worktrees` })).getByRole('button', {
      name,
    }),
  ).queryByTestId('branch-row-chip')?.textContent ?? null;

const shownCounts = (): ReadonlyArray<string | null> => [
  chipText('payments-api', /#418/),
  chipText('ledger-core', /#77/),
  document.querySelector('[data-rebase-all]')?.textContent ?? null,
];

const projectsList = (): Element | null => document.querySelector('[data-card-projects]');

describe('overview projects: load first, then show', () => {
  it('shows no count while the branches load one by one, then every count at once', async () => {
    seedSlowStatuses();
    await mountRail();

    expect(projectsList()?.getAttribute('aria-busy')).toBe('true');
    expect(shownCounts()).toEqual([null, null, null]);

    await answer({ worktreePath: paymentsMount.worktreePath, behind: 3 });

    expect(projectsList()?.getAttribute('aria-busy')).toBe('true');
    expect(shownCounts()).toEqual([null, null, null]);

    await answer({ worktreePath: ledgerMount.worktreePath, behind: 5 });

    await waitFor(() => expect(projectsList()?.getAttribute('aria-busy')).toBe('false'));
    const [payments, ledger, rebaseAll] = shownCounts();
    expect(payments).toBe('3 behind');
    expect(ledger).toBe('5 behind');
    expect(rebaseAll).toContain('2 branches behind');
  });

  it('keeps the last complete set on a refresh and swaps to the new one at once', async () => {
    seedSlowStatuses();
    await mountRail();
    await answer({ worktreePath: paymentsMount.worktreePath, behind: 3 });
    await answer({ worktreePath: ledgerMount.worktreePath, behind: 5 });
    await waitFor(() => expect(chipText('ledger-core', /#77/)).toBe('5 behind'));
    const before = shownCounts();

    act(() => {
      void refreshWorktreeStatuses({
        worktreePaths: [paymentsMount.worktreePath, ledgerMount.worktreePath],
      });
    });
    await bothAsked();
    await answer({ worktreePath: paymentsMount.worktreePath, behind: 1 });

    expect(projectsList()?.getAttribute('aria-busy')).toBe('false');
    expect(shownCounts()).toEqual(before);

    await answer({ worktreePath: ledgerMount.worktreePath, behind: 0 });

    await waitFor(() => expect(shownCounts()).toEqual(['1 behind', null, null]));
  });
});
