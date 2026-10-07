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
  ...sessionOf({ goal: 'Plan held' }),
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

const trigger = () => screen.getByRole('button', { name: /need|running/ });

const wordOf = (word: string) => screen.queryByText(word);

describe('the Now chip counts sessions by their stage', () => {
  it('counts a running session that has a question as one that needs you', () => {
    seed([asking], [asking]);
    render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 session needs you');
    expect(wordOf('needs you')).not.toBeNull();
    expect(wordOf('need you')).toBeNull();
    expect(screen.queryByText('running')).toBeNull();
  });

  it('says need you from two on, and counts a held plan', () => {
    seed([asking, planHeld], [asking]);
    render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('2 sessions need you');
    expect(wordOf('need you')).not.toBeNull();
    expect(wordOf('needs you')).toBeNull();
  });

  it('keeps a running session with nothing waiting on you under running', () => {
    seed([asking, working], [asking]);
    render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 session needs you, 1 running');
  });

  it('lists the running session with a question under needs you, in the words of its reason', async () => {
    seed([asking, working], [asking]);
    render(<NowChip onOpenScript={vi.fn()} />);

    await act(async () => {
      fireEvent.click(trigger());
    });
    const panel = screen.getByRole('dialog', { name: 'Now' });
    const needs = within(within(panel).getByRole('list', { name: 'Needs you' }));
    const running = within(within(panel).getByRole('list', { name: 'Running' }));

    expect(needs.getByText('Running and asking')).toBeDefined();
    expect(needs.getByText('1 question for you')).toBeDefined();
    expect(running.queryByText('Running and asking')).toBeNull();
    expect(running.getByText('Running and quiet')).toBeDefined();
  });

  it('goes to the run page when the row is a held plan', async () => {
    seed([planHeld]);
    render(<NowChip onOpenScript={vi.fn()} />);

    await act(async () => {
      fireEvent.click(trigger());
    });
    const panel = screen.getByRole('dialog', { name: 'Now' });
    expect(within(panel).getByText('The plan waits for your approval')).toBeDefined();
    await act(async () => {
      fireEvent.click(within(panel).getByText('Plan held'));
    });

    expect(useAppStore.getState().activeLens[planHeld.id]).toBe('workflows');
    expect(useAppStore.getState().focusedWorkflowRunId[planHeld.id]).toBe('run-plan-held');
  });
});
