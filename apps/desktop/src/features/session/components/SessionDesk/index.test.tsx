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

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
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
import { SessionFace } from './SessionFace';
import { toggleCurrentFace } from './toggleCurrentFace';

const session = sessionOf({ goal: 'Reconcile the ledger export' });

let store: StoryStore;
const stops: Array<() => void> = [];

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    worktree_status: () => worktreeStatusOf({}),
    worktree_remote_url: () => 'git@github.com:harborline/ledger-core.git',
  });
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

  it('changes face at once, before the tool it opens has answered', () => {
    renderFace();

    act(() => {
      pressShortcut({ id: 'session.desk' });
    });

    expect(deskShown()).toBe(true);
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
  });
});
