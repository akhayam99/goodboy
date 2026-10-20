// @vitest-environment happy-dom

import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { brandId, type AgentId } from '@goodboy/types';
import { aSession, anAgent } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../auto/useAutoTrees', () => ({ useAutoTrees: () => [] }));

import { useAppStore } from '../../../../store';
import {
  at,
  eventOf,
  RUN_ID,
  SESSION_ID,
  stepAgent,
  workflowOf,
} from '../done/testing/doneFixtures';
import { manyBranchEvents, rebaseRequest } from '../done/testing/historyBatchFixtures';
import { LogDrawer } from './LogDrawer';

const WORLD = workflowOf({ total: 3 });

const SESSION = aSession({ id: SESSION_ID, workflowRuns: [WORLD.run] });

const AGENTS = [
  stepAgent({ index: 1, summary: 'Scoped the change.' }),
  anAgent({
    id: brandId<AgentId>({ value: 'scribe' }),
    sessionId: SESSION_ID,
    kind: 'scribe',
    name: 'Summarise the plan',
    status: 'completed',
    startedAt: at({ hour: 9 }),
    completedAt: at({ hour: 9, minute: 40 }),
  }),
];

const EVENTS = [
  eventOf({
    id: 'pr',
    kind: 'pr_created',
    payload: { number: 309 },
    createdAt: at({ hour: 10, minute: 30 }),
  }),
  eventOf({
    id: 'decisions',
    kind: 'decisions_changed',
    payload: { added: 2 },
    createdAt: at({ hour: 10, minute: 10 }),
  }),
  eventOf({
    id: 'rebase',
    kind: 'rebase_requested',
    payload: { branch: 'main' },
    createdAt: at({ hour: 9, minute: 5 }),
  }),
];

const idle = vi.fn(async () => undefined);

const rowOf = ({ id }: { readonly id: string }): Element | null =>
  document.querySelector(`[data-row-id="${id}"]`);

type SetupParams = {
  readonly focusEntryId: string | null;
  readonly onClose?: () => void;
};

const setup = ({ focusEntryId, onClose = vi.fn() }: SetupParams) =>
  render(
    <ToastProvider>
      <LogDrawer sessionId={SESSION_ID} focusEntryId={focusEntryId} onClose={onClose} />
    </ToastProvider>,
  );

const scrollIntoView = vi.fn();

beforeAll(async () => {
  installFakeResizeObserver();
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
  useAppStore.setState({
    sessions: [SESSION],
    currentSessionId: SESSION_ID,
    sessionPhaseRuns: { [SESSION_ID]: AGENTS },
    sessionWorkflows: { [SESSION_ID]: [WORLD.workflow] },
    sessionEvents: { [SESSION_ID]: EVENTS },
    sessionTurnSpans: { [SESSION_ID]: [] },
    loadSessionTurnSpans: idle,
    loadWorkspaceDurationHistory: idle,
    loadSessionEvents: idle,
    loadSessionArtifacts: idle,
    loadSessionContextItems: idle,
    loadSessionAnsweredQuestions: idle,
    loadSessionDismissedQuestions: idle,
  });
});

afterEach(cleanup);

describe('LogDrawer batch of pushes', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessionEvents: {
        [SESSION_ID]: [rebaseRequest, ...manyBranchEvents({ count: 9, batchId: 'run-1' })],
      },
    });
  });

  it('shows one entry for the whole batch and none of its lines', () => {
    setup({ focusEntryId: null });

    expect(rowOf({ id: 'event:ps-8' })).not.toBeNull();
    expect(rowOf({ id: 'event:rw-0' })).toBeNull();
    expect(rowOf({ id: 'event:ps-0' })).toBeNull();
    expect(screen.getByText('Rebased 9 branches on main')).toBeDefined();
    expect(screen.getByText(/Rebase all · 9 pushed, 3 PRs updated/)).toBeDefined();
  });

  it('opens the lines of the batch under the entry and folds them back', () => {
    setup({ focusEntryId: null });
    const toggle = screen.getByRole('button', { name: /Rebased 9 branches on main/ });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Events of this batch' })).toBeNull();

    fireEvent.click(toggle);

    const list = screen.getByRole('list', { name: 'Events of this batch' });
    expect(list.querySelectorAll('li')).toHaveLength(18);
    expect(list.textContent).toContain('Pushed the new history of');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(toggle);

    expect(screen.queryByRole('list', { name: 'Events of this batch' })).toBeNull();
  });

  it('highlights the folded entry that Show in log asks for', () => {
    setup({ focusEntryId: 'event:ps-8' });

    const focused = document.querySelector('[data-log-focus]');

    expect(focused?.querySelector('[data-row-id="event:ps-8"]')).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe('LogDrawer', () => {
  it('holds runs, agents, pull request events and decisions together', () => {
    setup({ focusEntryId: null });

    expect(screen.getByRole('region', { name: 'Log' })).toBeDefined();
    expect(rowOf({ id: `run:${RUN_ID}` })).not.toBeNull();
    expect(rowOf({ id: 'agent:scribe' })).not.toBeNull();
    expect(rowOf({ id: 'event:pr' })).not.toBeNull();
    expect(rowOf({ id: 'event:decisions' })).not.toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('filters the entries by the search', () => {
    setup({ focusEntryId: null });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the log' }), {
      target: { value: 'rebase' },
    });

    expect(rowOf({ id: 'event:rebase' })).not.toBeNull();
    expect(rowOf({ id: 'event:pr' })).toBeNull();
    expect(rowOf({ id: 'agent:scribe' })).toBeNull();
  });

  it('scrolls to and highlights the focused entry', () => {
    setup({ focusEntryId: 'agent:scribe' });

    const focused = document.querySelector('[data-log-focus]');

    expect(focused?.querySelector('[data-row-id="agent:scribe"]')).not.toBeNull();
    expect(document.querySelectorAll('[data-log-focus]')).toHaveLength(1);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('opens at the top when the focused entry is gone', () => {
    setup({ focusEntryId: 'agent:deleted' });

    expect(document.querySelector('[data-log-focus]')).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(rowOf({ id: 'event:pr' })).not.toBeNull();
  });

  it('closes on Escape and gives the focus back to the trigger', () => {
    const Host = () => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <ToastProvider>
          <button type="button" onClick={() => setIsOpen(true)}>
            Full log
          </button>
          {isOpen ? (
            <LogDrawer
              sessionId={SESSION_ID}
              focusEntryId={null}
              onClose={() => setIsOpen(false)}
            />
          ) : null}
        </ToastProvider>
      );
    };
    render(<Host />);
    const trigger = screen.getByRole('button', { name: 'Full log' });
    trigger.focus();

    fireEvent.click(trigger);

    expect(screen.getByRole('region', { name: 'Log' })).toBeDefined();

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    });

    expect(screen.queryByRole('region', { name: 'Log' })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
