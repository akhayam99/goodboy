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
import { ledgerCore, mountOf, sessionOf } from '../../../workspace/testing/sessionColumn';
import { ToastProvider } from '../../../../shared/components/Toast';
import { toggleRailTool } from '../SessionTools/toggleRailTool';
import {
  installFakeResizeObserver,
  type FakeResizeObservers,
} from '../../../../test/fakeResizeObserver';
import { storedDockGridOf } from '../../../../store/slices/drawer/dockGridMemory/storedDockGrid';
import { watchSessionDockGrid } from '../../../workspace/hooks/useSessionDockGrid/watchSessionDockGrid';
import { SessionFace } from './SessionFace';
import { switchSessionFace } from './switchSessionFace';

const session = sessionOf({ goal: 'Reconcile the ledger export' });

const INVOKE = {
  worktree_status: () => worktreeStatusOf({}),
  worktree_remote_url: () => 'git@github.com:harborline/ledger-core.git',
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
      toggleRailTool({ pane: 'terminal', sessionId: session.id });
    });
  };

  it('stays on the Overview when Ask opens, because Ask is not a Desk tool', () => {
    seedWaitingAgent();
    renderFace();

    act(() => {
      store.getState().openAsk({ sessionId: session.id });
    });

    expect(store.getState().sessionFace[session.id] ?? 'overview').toBe('overview');
    expect(document.querySelector('[data-session-desk]')).toBeNull();
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
  it('shows the whole overview when a saved Desk comes back with no tool, and opens none', async () => {
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

    stops.push(watchSessionDockGrid({ store, delayMs: 0 }));
    await settle();

    expect(toolKinds()).toEqual([]);
    expect(face()).toBe('overview');
  });

  it('brings back a saved Desk beside the tool the window already has open', async () => {
    saved.row = storedDockGridOf({
      grid: {
        columns: [[{ kind: 'browser', sessionId: session.id, payload: null }]],
        used: ['browser'],
        focus: { at: 'page' },
        widths: {},
        splits: {},
      },
      face: 'desk',
    });
    store.getState().openDrawer({ kind: 'browser', sessionId: session.id, payload: null });
    renderFace();

    stops.push(watchSessionDockGrid({ store, delayMs: 0 }));
    await settle();

    expect(toolKinds()).toEqual(['browser']);
    expect(face()).toBe('desk');
  });

  it('opens nothing when the session was left before its Desk came back', async () => {
    saved.row = storedDockGridOf({
      grid: { columns: [], used: [], focus: { at: 'page' }, widths: {}, splits: {} },
      face: 'desk',
    });
    renderFace();
    stops.push(watchSessionDockGrid({ store, delayMs: 0 }));
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
      switchSessionFace({ sessionId: session.id, face: 'desk' });
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
