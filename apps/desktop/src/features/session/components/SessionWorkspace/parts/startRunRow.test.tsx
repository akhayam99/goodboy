// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useEscapeLayer } from '@goodboy/ui';
import { aSession } from '@goodboy/types/testing';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { aNowAgent, NOW_SESSION } from '../../../central/now/testing/nowModelOf';
import { startRunEventName } from '../../../startRun/startRunEventName';
import { WorkflowsPane } from './WorkflowsPane';

const session = aSession({ id: NOW_SESSION });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ currentWorkspaceId: session.workspaceId, sessions: [session] });
});

afterEach(cleanup);

const seedRun = () => {
  useAppStore.setState({
    sessionPhaseRuns: {
      [NOW_SESSION]: [
        aNowAgent({ key: 'impl', name: 'Implement the retry cap', status: 'running' }),
      ],
    },
  });
};

const renderPane = () =>
  render(
    <ToastProvider>
      <WorkflowsPane session={session} />
    </ToastProvider>,
  );

const box = () => screen.queryByRole('textbox', { name: 'Start a run' });

describe('WorkflowsPane', () => {
  it('is the form with no runs, and offers no Start a run row', () => {
    renderPane();

    expect(box()).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Start a run' })).toBeNull();
  });

  it('opens on the list with a Start a run row and keeps the form shut', () => {
    seedRun();

    renderPane();

    screen.getByRole('list', { name: 'Runs' });
    expect(box()).toBeNull();
    expect(screen.getByRole('button', { name: 'Start a run' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('opens the form in place from the row and closes it on Escape', () => {
    seedRun();
    renderPane();

    fireEvent.click(screen.getByRole('button', { name: 'Start a run' }));
    expect(box()).not.toBeNull();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(box()).toBeNull();
  });

  it('opens the form when something asks to start a run in this session', () => {
    seedRun();
    renderPane();

    act(() => {
      window.dispatchEvent(
        new CustomEvent(startRunEventName({ sessionId: NOW_SESSION }), {
          detail: { text: 'Limit webhook retries' },
        }),
      );
    });

    expect(box()).not.toBeNull();
  });

  it('hands Escape to the layers below once a run page covers the open form', () => {
    seedRun();
    const onEscape = vi.fn();
    renderHook(() => useEscapeLayer(onEscape, true));
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Start a run' }));

    act(() => {
      useAppStore.setState({ focusedWorkflowRunId: { [NOW_SESSION]: 'run-gone' } });
    });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onEscape).toHaveBeenCalledOnce();
  });

  it('comes back to the list with the form shut after a run page', () => {
    seedRun();
    renderPane();
    fireEvent.click(screen.getByRole('button', { name: 'Start a run' }));

    act(() => {
      useAppStore.setState({ focusedWorkflowRunId: { [NOW_SESSION]: 'run-gone' } });
    });
    act(() => {
      useAppStore.setState({ focusedWorkflowRunId: { [NOW_SESSION]: null } });
    });

    expect(box()).toBeNull();
    expect(screen.getByRole('button', { name: 'Start a run' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });
});
