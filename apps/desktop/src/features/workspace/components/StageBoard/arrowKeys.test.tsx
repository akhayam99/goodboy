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
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type { Session } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import { StageBoard } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const project = aProject({ workspaceId: workspace.id, name: 'ledger-core', kind: 'folder' });
const GOALS = [
  'Add idempotency keys to the refund endpoint',
  'Retry webhook delivery with backoff',
  'Cache FX rates per request in payments-api',
];
const sessions: ReadonlyArray<Session> = GOALS.map((goal) =>
  aSession({ workspaceId: workspace.id, goal }),
);

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
  useAppStore.setState({
    workspaces: [workspace],
    projects: [project],
    sessions: [...sessions],
    archivedSessions: { [workspace.id]: [] },
    boardReady: true,
    currentWorkspaceId: workspace.id,
  });
  render(
    <ToastProvider>
      <StageBoard workspaceId={workspace.id} sessions={sessions} />
    </ToastProvider>,
  );
});

afterEach(cleanup);

const titleOf = (goal: string): HTMLElement => screen.getByRole('button', { name: goal });

const orderedGoals = (): ReadonlyArray<string> =>
  [...document.querySelectorAll('[data-select-id]')].map(
    (card) => card.querySelector('button')?.textContent ?? '',
  );

const countText = (): string =>
  within(screen.getByRole('toolbar')).getByText(/selected/).textContent ?? '';

describe('StageBoard arrow keys', () => {
  it('moves focus down and up the lane without selecting', () => {
    const [first, second] = orderedGoals();
    const start = titleOf(first ?? '');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(titleOf(second ?? ''));
    fireEvent.keyDown(titleOf(second ?? ''), { key: 'ArrowUp' });
    expect(document.activeElement).toBe(start);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });

  it('stays on the last card of the lane', () => {
    const goals = orderedGoals();
    const last = titleOf(goals[goals.length - 1] ?? '');
    last.focus();
    fireEvent.keyDown(last, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(last);
  });

  it('extends the selection one card at a time with Shift and the arrows', () => {
    const goals = orderedGoals();
    const start = titleOf(goals[0] ?? '');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowDown', shiftKey: true });
    expect(countText()).toBe('2 selected');
    fireEvent.keyDown(titleOf(goals[1] ?? ''), { key: 'ArrowDown', shiftKey: true });
    expect(countText()).toBe('3 selected');
    fireEvent.keyDown(titleOf(goals[2] ?? ''), { key: 'ArrowUp', shiftKey: true });
    expect(countText()).toBe('2 selected');
  });

  it('names how to extend once a card is selected', () => {
    fireEvent.click(titleOf(orderedGoals()[0] ?? ''), { altKey: true });
    screen.getByText('Shift click for a range, Option click to add one');
  });
});
