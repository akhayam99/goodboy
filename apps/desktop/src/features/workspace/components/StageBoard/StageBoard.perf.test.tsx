// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { IsoDateTime, Session } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { StageBoard } from './index';

const MOUNT_BUDGET_MS = 8000;
const SELECT_ALL_BUDGET_MS = 3000;
const DONE_COUNT = 300;

const NOW = '2026-10-07T09:00:00.000Z' as IsoDateTime;

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({ workspaceId: workspace.id, name: 'ledger-core', kind: 'folder' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const mergedGithub = (number: number) => ({
  fetchedAt: NOW,
  pr: {
    number,
    title: `Change ${number}`,
    url: `https://example.invalid/harborline/pull/${number}`,
    state: 'merged' as const,
    mergeable: null,
    checks: 'success' as const,
    baseBranch: 'main',
    headBranch: `hl/change-${number}`,
    isDraft: false,
    reviewDecision: null,
    body: '',
    updatedAt: NOW,
  },
  linkedIssues: [],
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

describe('StageBoard with 300 Done sessions, performance', () => {
  it('renders every Done card and selects them all within the budgets', () => {
    const done: ReadonlyArray<Session> = Array.from({ length: DONE_COUNT }, (_, index) =>
      aSession({ workspaceId: workspace.id, goal: `Ship the settlement change ${index + 1}` }),
    );
    useAppStore.setState({
      workspaces: [workspace],
      projects: [project],
      sessions: [...done],
      archivedSessions: { [workspace.id]: [] },
      sessionGithub: Object.fromEntries(
        done.map((session, index) => [session.id, mergedGithub(100 + index)]),
      ),
      boardReady: true,
      currentWorkspaceId: workspace.id,
      loadArchivedSessions: async () => undefined,
    });

    const mountStarted = performance.now();
    render(
      <ToastProvider>
        <StageBoard workspaceId={workspace.id} sessions={done} />
      </ToastProvider>,
    );
    const mountElapsed = performance.now() - mountStarted;

    const lane = screen.getByRole('group', { name: 'done' });
    expect(within(lane).getAllByRole('checkbox')).toHaveLength(DONE_COUNT);
    expect(mountElapsed).toBeLessThan(MOUNT_BUDGET_MS);

    fireEvent.click(within(lane).getAllByRole('checkbox')[0] as HTMLElement);
    const selectStarted = performance.now();
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: `Select all ${DONE_COUNT}` }));
    });
    const selectElapsed = performance.now() - selectStarted;

    expect(within(screen.getByRole('toolbar')).getByText(`${DONE_COUNT} selected`)).toBeDefined();
    expect(selectElapsed).toBeLessThan(SELECT_ALL_BUDGET_MS);
  });
});
