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
import { aWorkflowRun } from '@goodboy/types/testing';
import type { Session, WorkflowRunId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  runningState,
  seedColumn,
  sessionOf,
} from '../../../../features/workspace/testing/sessionColumn';
import { NowChip } from './index';
import { SideColumn } from '../../SideColumn';
import type { ColumnActions } from '../../SideColumn/columnDoors';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

const asking = sessionOf({ goal: 'Running and asking', state: runningState() });
const planHeld: Session = {
  ...sessionOf({ goal: 'Plan held', updatedAt: '2026-10-06T09:00:00.000Z' }),
  workflowRuns: [
    aWorkflowRun({
      id: 'run-plan-held' as WorkflowRunId,
      orchestrationStop: { kind: 'plan-approval', message: 'The plan is ready.' },
    }),
  ],
};
const working = sessionOf({ goal: 'Running and quiet', state: runningState() });

const seed = (sessions: ReadonlyArray<Session>, questions: ReadonlyArray<Session> = []) => {
  seedColumn({ store: useAppStore, sessions, questions });
};

const trigger = () => screen.getByRole('button', { name: /^\d+ (needs?|sessions?|scripts?) / });

const noop = () => undefined;

const ACTIONS: ColumnActions = {
  openBoard: noop,
  openInbox: noop,
  openChat: noop,
  openWorkflows: noop,
  openTerminalStudio: noop,
  openNewChat: noop,
  openNewTerminal: noop,
  openMonitoring: noop,
  openImpact: noop,
  openSettings: noop,
  openChangelog: noop,
  openGuide: noop,
  openShortcuts: noop,
};

const renderShell = () =>
  render(
    <>
      <NowChip onOpenScript={vi.fn()} />
      <SideColumn
        scope="workspace"
        workspaceId={useAppStore.getState().currentWorkspaceId}
        currentSessionId={null}
        place={null}
        actions={ACTIONS}
      />
    </>,
  );

const sessionsDoor = (): HTMLElement => {
  const door = document.querySelector<HTMLElement>('[data-side-column] [data-column-door="board"]');
  if (door === null) {
    throw new Error('no Sessions door');
  }
  return door;
};

describe('the Sessions door and the Now chip count sessions by their stage', () => {
  it('marks a running session that has a question on the Sessions door and in the Now chip', () => {
    seed([asking], [asking]);
    renderShell();

    expect(sessionsDoor().getAttribute('aria-label')).toBe(
      'Sessions, 1 needs you: 1 question for you',
    );
    expect(sessionsDoor().querySelector('[data-door-signal="warning"]')).not.toBeNull();
    expect(trigger().getAttribute('aria-label')).toBe('1 needs you');
    expect(screen.queryByRole('button', { name: /running/ })).toBeNull();
  });

  it('counts a held plan beside the question, each reason once', () => {
    seed([asking, planHeld], [asking]);
    renderShell();

    expect(sessionsDoor().getAttribute('aria-label')).toBe(
      'Sessions, 2 need you: 1 question for you, The plan waits for your approval',
    );
  });

  it('lists a running session that has a question under needs you, not under running', async () => {
    seed([asking, working], [asking]);
    renderShell();

    expect(trigger().getAttribute('aria-label')).toBe('1 needs you, 1 session running');
    await act(async () => {
      fireEvent.click(trigger());
    });
    const panel = screen.getByRole('dialog', { name: 'Now' });
    const running = within(within(panel).getByRole('list', { name: 'Running' }));
    const needsYou = within(within(panel).getByRole('list', { name: 'Needs you' }));
    needsYou.getByText('Running and asking');
    expect(running.queryByText('Running and asking')).toBeNull();
    expect(running.getByText('Running and quiet')).toBeDefined();
  });

  it('drops the dot once nothing needs you', () => {
    seed([working]);
    renderShell();

    expect(sessionsDoor().getAttribute('aria-label')).toBe('Sessions');
    expect(sessionsDoor().querySelector('[data-door-signal]')).toBeNull();
  });
});
