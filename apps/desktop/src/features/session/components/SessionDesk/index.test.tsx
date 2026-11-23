// @vitest-environment happy-dom
const saved = vi.hoisted((): { row: string | null } => ({ row: null }));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../store/storyHarness')).dbModuleMock({
    listNudgeEvents: async () => [],
    listArtifactComments: async () => [],
    getSessionDockGrid: async () => saved.row,
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { worktreeStatusOf } from '../../../../test/worktreeStatusOf';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { currentStack } from '../../../../store/slices/navigation/currentStack';
import { registerShortcut } from '../../../../shared/keyboard/dispatcher';
import { pressKey, pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { ledgerCore, mountOf, sessionOf } from '../../../workspace/testing/sessionColumn';
import { SessionPageTabs } from '../../../../app/components/SessionPageTabs';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { storedDockGridOf } from '../../../../store/slices/drawer/dockGridMemory/storedDockGrid';
import { watchSessionDockGrid } from '../../../workspace/hooks/useSessionDockGrid/watchSessionDockGrid';
import { SessionFace } from './SessionFace';
import { startDeskTool } from './startDeskTool';
import { toggleCurrentFace } from './toggleCurrentFace';

const session = sessionOf({ goal: 'Reconcile the ledger export' });

const INVOKE = {
  worktree_status: () => worktreeStatusOf({}),
  worktree_remote_url: () => 'git@github.com:harborline/ledger-core.git',
};

type EnteredParams = {
  readonly sessionId: SessionId;
};

const startDeskTerminal = ({ sessionId }: EnteredParams): void => {
  void startDeskTool({ sessionId, mountId: null });
};

let store: StoryStore;
let observers: FakeResizeObservers;
const stops: Array<() => void> = [];

beforeAll(async () => {
  store = await importStore();
  observers = installFakeResizeObserver();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  saved.row = null;
  stubStoryInvoke(INVOKE);
  store.setState({
    currentWorkspaceId: session.workspaceId,
    sessions: [session],
    sessionProjectMounts: { [session.id]: [mountOf({ session, project: ledgerCore })] },
    setCurrentSession: async (id: SessionId | null) => {
      store.setState({ currentSessionId: id });
    },
  });
  await act(async () => {
    store.getState().navigate({ to: sessionPlace({ sessionId: session.id }) });
  });
  stops.push(registerShortcut('session.desk', toggleCurrentFace, { canDecline: true }));
});

afterEach(() => {
  while (stops.length > 0) {
    stops.pop()?.();
  }
  cleanup();
  document.body.innerHTML = '';
});

const renderFace = () =>
  render(
    <ToastProvider>
      <SessionFace session={session} />
    </ToastProvider>,
  );

const face = () => store.getState().sessionFace[session.id] ?? 'overview';

const entries = () => currentStack(store.getState()).entries.length;

const deskShown = () => screen.queryByRole('complementary', { name: 'Desk' }) !== null;

const toolKinds = () =>
  store
    .getState()
    .drawerGrid.columns.flat()
    .map((panel) => panel.kind);

const settle = async () => {
  await act(async () => {
    for (let step = 0; step < 10; step += 1) {
      await Promise.resolve();
    }
  });
};

const narrow = () => {
  act(() => {
    observers.resizeAll();
  });
};

describe('the two faces of a session', () => {
  it('switches to the Desk and back on the key, with no history entry', () => {
    renderFace();
    const before = entries();

    act(() => {
      pressShortcut({ id: 'session.desk' });
    });
    expect(face()).toBe('desk');
    expect(deskShown()).toBe(true);
    expect(entries()).toBe(before);

    act(() => {
      pressShortcut({ id: 'session.desk' });
    });
    expect(face()).toBe('overview');
    expect(deskShown()).toBe(false);
    expect(entries()).toBe(before);
  });

  it('changes face at once, before the tool it opens has answered', async () => {
    renderFace();

    act(() => {
      pressShortcut({ id: 'session.desk' });
    });

    expect(deskShown()).toBe(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      store
        .getState()
        .drawerGrid.columns.flat()
        .map((panel) => panel.kind),
    ).toContain('terminal');
  });

  it('switches while the focus is in a terminal', () => {
    renderFace();
    const terminal = document.createElement('div');
    terminal.className = 'xterm';
    const input = document.createElement('textarea');
    terminal.append(input);
    document.body.append(terminal);
    input.focus();

    const events: Array<KeyboardEvent> = [];
    act(() => {
      events.push(pressShortcut({ id: 'session.desk', target: input }));
    });

    expect(face()).toBe('desk');
    expect(events.map((event) => event.defaultPrevented)).toEqual([true]);
  });

  it('leaves the face where it is on Esc, as the overview does', () => {
    renderFace();
    act(() => {
      pressShortcut({ id: 'session.desk' });
    });

    act(() => {
      pressKey({ code: 'Escape' });
    });

    expect(face()).toBe('desk');
    expect(deskShown()).toBe(true);
  });

  it('declines the key away from a session, so it reaches the page', async () => {
    await act(async () => {
      store.setState({ currentSessionId: null });
    });

    const event = pressShortcut({ id: 'session.desk' });

    expect(event.defaultPrevented).toBe(false);
  });
});

describe('the Overview | Desk control', () => {
  it('sits beside the page tabs, names the key and lights the face on the overview', () => {
    render(<SessionPageTabs session={session} />);
    const control = screen.getByRole('tablist', { name: 'Overview or Desk' });

    fireEvent.click(within(control).getByRole('tab', { name: 'Desk' }));

    expect(face()).toBe('desk');
    expect(within(control).getByRole('tab', { name: 'Desk' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('lights no face on a page that is not a face, and the Desk leads back to the overview', async () => {
    await act(async () => {
      store.getState().navigate({ to: sessionPlace({ sessionId: session.id, lens: 'context' }) });
    });
    const before = entries();
    render(<SessionPageTabs session={session} />);
    const control = screen.getByRole('tablist', { name: 'Overview or Desk' });

    expect(
      within(control)
        .getAllByRole('tab')
        .filter((tab) => tab.getAttribute('aria-selected') === 'true'),
    ).toEqual([]);

    await act(async () => {
      fireEvent.click(within(control).getByRole('tab', { name: 'Desk' }));
    });

    expect(face()).toBe('desk');
    expect(store.getState().activeLens[session.id] ?? null).toBeNull();
    expect(entries()).toBe(before);
  });
});

describe('the Desk column', () => {
  const agent = anAgent({ sessionId: session.id });

  const seedWaitingAgent = () => {
    store.setState({
      sessionPhaseRuns: { [session.id]: [agent] },
      agentWriterWait: {
        [agent.id]: {
          sessionId: session.id,
          blockedPath: 'src/ledger.ts',
          blockedBy: null,
          since: brandId<IsoDateTime>({ value: '2026-11-22T10:00:00.000Z' }),
        },
      },
    });
  };

  const openDesk = () => {
    act(() => {
      pressShortcut({ id: 'session.desk' });
    });
  };

  const askLine = () => document.querySelector('[data-desk-ask]');

  it('keeps the Ask line until the Ask panel of this session opens', () => {
    seedWaitingAgent();
    renderFace();
    openDesk();
    expect(askLine()).not.toBeNull();

    act(() => {
      store.getState().openDrawer({ kind: 'ask', sessionId: session.id, payload: null });
    });

    expect(askLine()).toBeNull();
  });

  it('keeps the Ask line in the popover of a narrow Desk', () => {
    seedWaitingAgent();
    renderFace();
    openDesk();
    narrow();

    const row = document.querySelector<HTMLElement>('[data-desk-status-row]');
    expect(row).not.toBeNull();
    fireEvent.click(within(row ?? document.body).getByRole('button'));

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[data-desk-ask]')).not.toBeNull();
  });

  it('counts a wait in the Now of the narrow status line', () => {
    seedWaitingAgent();
    renderFace();
    openDesk();
    narrow();

    expect(document.querySelector('[data-desk-status-row]')?.textContent).toContain('Now 1');
  });
});

describe('the tool the Desk opens', () => {
  it('opens the terminal when a saved Desk comes back with no tool', async () => {
    saved.row = storedDockGridOf({
      grid: {
        columns: [[{ kind: 'monitoring', sessionId: null, payload: null }]],
        used: ['monitoring'],
        focus: { at: 'page' },
        widths: {},
        splits: {},
      },
      face: 'desk',
    });
    renderFace();

    stops.push(watchSessionDockGrid({ store, delayMs: 0, onEntered: startDeskTerminal }));
    await settle();

    expect(face()).toBe('desk');
    expect(toolKinds()).toEqual(['terminal']);
  });

  it('opens nothing when the session was left before its Desk came back', async () => {
    saved.row = storedDockGridOf({
      grid: { columns: [], used: [], focus: { at: 'page' }, widths: {}, splits: {} },
      face: 'desk',
    });
    renderFace();
    stops.push(watchSessionDockGrid({ store, delayMs: 0, onEntered: startDeskTerminal }));
    await act(async () => {
      store.getState().navigate({ to: sessionPlace({ sessionId: session.id, lens: 'context' }) });
    });
    await settle();

    expect(toolKinds()).toEqual([]);
  });

  it('shows the terminal loading on a session with no branch, then an error whose Retry waits busy and opens it', async () => {
    const answers: Array<{
      readonly resolve: (cwd: string) => void;
      readonly reject: (error: Error) => void;
    }> = [];
    stubStoryInvoke({
      ...INVOKE,
      scratch_dir_prepare: () =>
        new Promise<string>((resolve, reject) => {
          answers.push({ resolve, reject });
        }),
    });
    store.setState({ sessionBranches: { [session.id]: '' } });
    renderFace();

    act(() => {
      pressShortcut({ id: 'session.desk' });
    });
    await settle();
    screen.getByRole('status', { name: 'Opening the terminal' });
    expect(toolKinds()).toEqual([]);

    answers.shift()?.reject(new Error('disk full'));
    await settle();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('disk full');
    expect(toolKinds()).toEqual([]);

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    await settle();
    const retry = within(screen.getByRole('alert')).getByRole('button', { name: 'Retry' });
    expect(retry.getAttribute('aria-busy')).toBe('true');

    answers.shift()?.resolve('/scratch/ledger-core');
    await settle();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(toolKinds()).toEqual(['terminal']);
  });
});
