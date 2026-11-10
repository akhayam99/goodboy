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
import type { Session } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  harborline,
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

const RUNNING = sessionOf({ goal: 'Retry failed webhook deliveries', state: runningState() });
const ASKING = sessionOf({
  goal: 'Pick the retry backoff for notify-relay',
  state: runningState(),
});
const SCRIPT_ID = 'script-1';

const seed = (sessions: ReadonlyArray<Session>, questions: ReadonlyArray<Session> = []) => {
  seedColumn({ store: useAppStore, sessions, questions });
};

const withScript = (session: Session) => {
  useAppStore.setState({
    scriptRuns: {
      [session.id]: {
        [SCRIPT_ID]: {
          status: 'pending',
          result: null,
          runId: 'run-1',
          startedAt: Date.now(),
          name: 'pnpm dev',
        },
      },
    },
  });
};

const trigger = () => screen.getByRole('button', { name: /running/ });

const open = async () => {
  await act(async () => {
    fireEvent.click(trigger());
  });
  return screen.getByRole('dialog', { name: 'Now' });
};

describe('NowChip', () => {
  it('draws one muted Idle slot, never nothing, when no session runs and no script plays', () => {
    seed([]);
    const { container } = render(<NowChip onOpenScript={vi.fn()} />);

    expect(container.querySelector('[data-now-idle]')?.textContent).toBe('Idle');
    expect(screen.queryByRole('button', { name: /running/ })).toBeNull();
  });

  it('shows only the segments above zero, and names them all in one label', () => {
    seed([RUNNING]);
    const { container } = render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 session running');
    expect(container.querySelector('[data-now-idle]')).toBeNull();
    expect(screen.queryByText('scripts')).toBeNull();

    act(() => {
      withScript(RUNNING);
    });

    expect(trigger().getAttribute('aria-label')).toBe('1 session running, 1 script running');
    expect(screen.getByText('scripts')).toBeDefined();
  });

  it('leaves needs you to the Sessions door and the Overview: no segment, no group, no next button', async () => {
    seed([RUNNING, ASKING], [ASKING]);
    withScript(RUNNING);
    const { container } = render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 session running, 1 script running');
    expect(container.querySelector('[data-now-needs-you]')).toBeNull();
    const panel = await open();
    expect(within(panel).queryByRole('list', { name: 'Needs you' })).toBeNull();
    expect(within(panel).queryByText('Pick the retry backoff for notify-relay')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Next that needs you' })).toBeNull();
    within(panel).getByRole('list', { name: 'Running' });
    within(panel).getByRole('list', { name: 'Scripts' });
  });

  it('opens a session from its row and closes', async () => {
    seed([RUNNING]);
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();
    await act(async () => {
      fireEvent.click(within(panel).getByText('Retry failed webhook deliveries'));
    });

    expect(useAppStore.getState().currentSessionId).toBe(RUNNING.id);
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('ends on Open Monitoring, the home of the numbers it counts, and closes', async () => {
    seed([RUNNING]);
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Open Monitoring' }));
    });

    expect(useAppStore.getState().appStudio).toEqual({ kind: 'monitoring' });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('names a session with a blank goal the way every session row does', async () => {
    seed([sessionOf({ goal: '   ', state: runningState() })]);
    render(<NowChip onOpenScript={vi.fn()} />);

    const panel = await open();

    within(panel).getByRole('button', { name: /Untitled session/ });
  });

  it('opens the session hover card for a row after the pointer rests and drops it on leave', async () => {
    seed([RUNNING]);
    render(<NowChip onOpenScript={vi.fn()} />);
    const panel = await open();
    const row = within(panel).getByRole('button', { name: /Retry failed webhook deliveries/ });

    vi.useFakeTimers();
    fireEvent.mouseEnter(row);
    expect(screen.queryByTestId('session-hover-card')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('session-hover-card').textContent).toContain(
      'Retry failed webhook deliveries',
    );

    fireEvent.mouseLeave(row);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('session-hover-card')).toBeNull();
    vi.useRealTimers();
  });

  it('closes the hover card with the popover', async () => {
    seed([RUNNING]);
    render(<NowChip onOpenScript={vi.fn()} />);
    const panel = await open();
    const row = within(panel).getByRole('button', { name: /Retry failed webhook deliveries/ });

    vi.useFakeTimers();
    fireEvent.mouseEnter(row);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('session-hover-card')).toBeDefined();
    vi.useRealTimers();

    await act(async () => {
      fireEvent.click(row);
    });

    expect(screen.queryByTestId('session-hover-card')).toBeNull();
  });

  it('hands a script row to the open callback and stops it in place', async () => {
    seed([RUNNING]);
    withScript(RUNNING);
    stubStoryInvoke({ workspace_script_cancel: () => undefined });
    const onOpenScript = vi.fn();
    render(<NowChip onOpenScript={onOpenScript} />);

    let panel = await open();
    await act(async () => {
      fireEvent.click(within(panel).getByRole('button', { name: 'Stop pnpm dev' }));
    });
    expect(useAppStore.getState().scriptRuns[RUNNING.id]?.[SCRIPT_ID]?.status).toBe('cancelled');

    act(() => {
      withScript(RUNNING);
    });
    panel = screen.getByRole('dialog', { name: 'Now' });
    await act(async () => {
      fireEvent.click(
        within(panel).getByRole('button', {
          name: 'Show pnpm dev output from Retry failed webhook deliveries',
        }),
      );
    });

    expect(onOpenScript).toHaveBeenCalledOnce();
    expect(onOpenScript.mock.calls[0]?.[0]).toMatchObject({
      sessionId: RUNNING.id,
      scriptId: SCRIPT_ID,
    });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('opens on the named popover layer, closes on escape with focus back, and on the backdrop', async () => {
    seed([RUNNING]);
    render(<NowChip onOpenScript={vi.fn()} />);

    await open();
    expect(document.body.querySelector('.z-popover')).not.toBeNull();

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
    expect(document.activeElement).toBe(trigger());

    await open();
    const backdrop = document.body.querySelector('.z-popover-backdrop');
    expect(backdrop).not.toBeNull();
    await act(async () => {
      fireEvent.click(backdrop ?? document.body);
    });
    expect(screen.queryByRole('dialog', { name: 'Now' })).toBeNull();
  });

  it('leaves session signals out without a workspace but still shows scripts', () => {
    seed([ASKING]);
    useAppStore.setState({ currentWorkspaceId: null, workspaces: [harborline] });
    withScript(ASKING);
    render(<NowChip onOpenScript={vi.fn()} />);

    expect(trigger().getAttribute('aria-label')).toBe('1 script running');
  });
});
