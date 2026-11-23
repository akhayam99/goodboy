// @vitest-environment happy-dom

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
  }),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);
vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: () => <div data-testid="terminal-panel" />,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { worktreeStatusOf } from '../../../../test/worktreeStatusOf';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { selectGridTool } from '../../../../store/slices/drawer/selectGridTool';
import { registerShortcut } from '../../../../shared/keyboard/dispatcher';
import { pressShortcut } from '../../../../__tests__/helpers/pressKey';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  harborline,
  ledgerCore,
  mountOf,
  notifyRelay,
  paymentsApi,
  sessionOf,
} from '../../../workspace/testing/sessionColumn';
import { brandedId } from '../../../history/testing/brandedId';
import { toggleTerminalDock } from '../../toggleTerminalDock';
import { toggleCurrentFace } from '../../../session/components/SessionDesk/toggleCurrentFace';
import { TerminalDrawer } from '.';

const session = sessionOf({ goal: 'Retry the webhook' });

const payments = mountOf({ session, project: paymentsApi });

const relay = mountOf({ session, project: notifyRelay });

const TAB: TerminalTab = {
  id: brandedId<TerminalTabId>({ value: `${session.id}::t1` }),
  owner: { kind: 'session', sessionId: session.id },
  title: 'payments-api',
  cwd: payments.worktreePath,
  mountId: payments.mountId,
  status: 'running',
  createdAt: 0,
};

let store: StoryStore;
const stops: Array<() => void> = [];
const onClose = vi.fn();

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  onClose.mockReset();
  stubStoryInvoke({
    terminal_open: null,
    terminal_write: null,
    terminal_list_live: [],
    terminal_close: null,
    monitor_snapshot: { listeners: [], processes: [], takenAt: 0, isPlatformSupported: true },
    process_ledger_list: [],
    monitor_watched_ports: [],
    project_scripts_scan: [],
    worktree_status: () => worktreeStatusOf({}),
  });
  store.setState({
    workspaces: [harborline],
    currentWorkspaceId: harborline.id,
    projects: [paymentsApi, ledgerCore, notifyRelay],
    sessions: [session],
    sessionProjectMounts: { [session.id]: [payments, relay] },
    terminalTabs: { [session.id]: [TAB] },
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
});

type RenderParams = {
  readonly terminalId: TerminalTabId;
};

const renderDrawer = ({ terminalId }: RenderParams) =>
  render(
    <ToastProvider>
      <TerminalDrawer sessionId={session.id} terminalId={terminalId} onClose={onClose} />
    </ToastProvider>,
  );

const shownTerminal = (): TerminalTab | null => {
  const state = store.getState();
  const entry = selectGridTool({ state, kind: 'terminal' });
  if (entry?.kind !== 'terminal') {
    return null;
  }
  return (
    (state.terminalTabs[session.id] ?? []).find((tab) => tab.id === entry.payload.terminalId) ??
    null
  );
};

const face = () => store.getState().sessionFace[session.id] ?? 'overview';

describe('one tab per track', () => {
  it('names each mounted project, with the branch and the folder in the head', async () => {
    renderDrawer({ terminalId: TAB.id });

    const tracks = await screen.findByRole('tablist', { name: 'Worktrees' });
    expect(
      within(tracks)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['payments-api', 'notify-relay']);
    expect(
      within(tracks).getByRole('tab', { name: 'payments-api' }).getAttribute('aria-selected'),
    ).toBe('true');
    screen.getByText(payments.branch);
    screen.getByText(`· ${session.id}`);
  });

  it('opens the shell of a track on its first focus and reuses it after', async () => {
    renderDrawer({ terminalId: TAB.id });
    const tracks = await screen.findByRole('tablist', { name: 'Worktrees' });

    act(() => {
      fireEvent.click(within(tracks).getByRole('tab', { name: 'notify-relay' }));
    });
    const opened = shownTerminal();
    expect(opened?.cwd).toBe(relay.worktreePath);
    expect(store.getState().terminalTabs[session.id]).toHaveLength(2);

    act(() => {
      fireEvent.click(within(tracks).getByRole('tab', { name: 'payments-api' }));
    });
    expect(shownTerminal()?.id).toBe(TAB.id);
    expect(store.getState().terminalTabs[session.id]).toHaveLength(2);
  });
});

describe('the terminal over the overview', () => {
  it('opens on the key without changing face, and Open on desk takes it to the Desk', async () => {
    stops.push(
      registerShortcut('terminal.studio', () =>
        toggleTerminalDock({ isToggle: true, shouldFocusFirst: true }),
      ),
      registerShortcut('session.desk', toggleCurrentFace),
    );

    act(() => {
      pressShortcut({ id: 'terminal.studio' });
    });

    expect(face()).toBe('overview');
    const shown = shownTerminal();
    expect(shown).not.toBeNull();

    renderDrawer({ terminalId: shown?.id ?? TAB.id });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Open on desk' }));
    });

    expect(face()).toBe('desk');
    expect(shownTerminal()?.id).toBe(shown?.id);
    expect(screen.queryByRole('button', { name: 'Open on desk' })).toBeNull();
  });
});

describe('a shell that ends with an error', () => {
  it('stays with its output and Restart', async () => {
    renderDrawer({ terminalId: TAB.id });
    await screen.findByTestId('terminal-panel');

    act(() => {
      store.getState().setTerminalTabStatus({ owner: TAB.owner, tabId: TAB.id, status: 'exited' });
    });

    expect(onClose).not.toHaveBeenCalled();
    screen.getByTestId('terminal-panel');
    screen.getByText('exited');

    fireEvent.click(screen.getByRole('button', { name: 'Restart payments-api' }));

    await waitFor(() =>
      expect((store.getState().terminalTabs[session.id] ?? []).map((tab) => tab.id)).not.toContain(
        TAB.id,
      ),
    );
    expect(store.getState().terminalTabs[session.id]?.map((tab) => tab.cwd)).toEqual([
      payments.worktreePath,
    ]);
    expect(onClose).not.toHaveBeenCalled();
  });
});
