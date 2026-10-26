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

const tauri = vi.hoisted(() => ({
  label: 'main',
  isFocused: false,
  setBadgeCount: vi.fn(async (_count?: number) => undefined),
  sendNotification: vi.fn(),
  isPermissionGranted: vi.fn(async () => true),
  requestPermission: vi.fn(async () => 'granted'),
  onAction: vi.fn(async (_callback: (event: unknown) => void) => ({
    unregister: vi.fn(async () => undefined),
  })),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    label: tauri.label,
    setBadgeCount: tauri.setBadgeCount,
    isFullscreen: async () => false,
  }),
  primaryMonitor: async () => null,
}));
vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: class {},
  getAllWebviewWindows: async () => [
    {
      label: tauri.label,
      isFocused: async () => tauri.isFocused,
      unminimize: async () => undefined,
      setFocus: async () => undefined,
    },
  ],
}));
vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: tauri.sendNotification,
  isPermissionGranted: tauri.isPermissionGranted,
  requestPermission: tauri.requestPermission,
  onAction: tauri.onAction,
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { ToastProvider } from '../../../../shared/components/Toast';
import {
  failedState,
  harborline,
  ledgerCore,
  notifyRelay,
  openQuestionFor,
  paymentsApi,
  seedColumn,
  sessionOf,
} from '../../../workspace/testing/sessionColumn';
import { useAwayAlertsStore } from '../../away/awayAlertsStore';
import { useAwayAlerts } from '.';

const NORTHWIND = brandId<WorkspaceId>({ value: 'workspace-northwind' });
const ACME = brandId<WorkspaceId>({ value: 'workspace-acme' });

const entryOf = ({ count }: { readonly count: number }) => ({
  count,
  tone: 'warning' as const,
  reasonWords: ['1 question for you'],
});

const retry = sessionOf({ goal: 'Pick the retry window for notify-relay' });
const rounding = sessionOf({ goal: 'Round settlement totals in ledger-core' });
const webhook = sessionOf({ goal: 'Sign webhooks in payments-api' });
const quiet = sessionOf({ goal: 'Tidy the ledger-core readme' });
const SESSIONS = [retry, rounding, webhook, quiet];

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.clearAllMocks();
  tauri.label = 'main';
  tauri.isFocused = false;
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
  localStorage.clear();
  useAwayAlertsStore.setState({ isBadgeOn: true, bannerChoice: 'on' });
  seedColumn({
    store,
    sessions: SESSIONS,
    mounts: [
      [retry, notifyRelay],
      [rounding, ledgerCore],
      [webhook, paymentsApi],
      [quiet, ledgerCore],
    ],
  });
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

const Wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const ask = (sessions: ReadonlyArray<typeof retry>) => {
  act(() => {
    store.setState({
      sessionOpenQuestions: Object.fromEntries(
        sessions.map((session) => [session.id, [openQuestionFor({ sessionId: session.id })]]),
      ),
    });
  });
};

const Tree = () => {
  useAwayAlerts();
  return null;
};

const renderTree = () =>
  render(
    <ToastProvider>
      <Tree />
    </ToastProvider>,
  );

const mount = () => renderHook(() => useAwayAlerts(), { wrapper: Wrapper });

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('the dock badge', () => {
  it('shows the number of sessions that need you, the same count as the door', async () => {
    ask([retry, rounding]);
    mount();

    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(2));
  });

  it('adds what needs you in the other workspaces, from the database and from other windows', async () => {
    ask([retry]);
    act(() =>
      store.setState({
        attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2 }) },
        attentionFromWindows: { [ACME]: entryOf({ count: 4 }) },
        windowPresence: { 'win-acme': ACME },
      }),
    );
    mount();

    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(7));
  });

  it('counts the workspace of this window once, whatever a window report says about it', async () => {
    ask([retry]);
    act(() =>
      store.setState({
        attentionFromWindows: { [harborline.id]: entryOf({ count: 9 }) },
      }),
    );
    mount();

    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(1));
  });

  it('follows the other workspaces down to nothing', async () => {
    act(() => store.setState({ attentionFromDatabase: { [NORTHWIND]: entryOf({ count: 2 }) } }));
    mount();
    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(2));

    act(() => store.setState({ attentionFromDatabase: {} }));

    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(undefined));
  });

  it('follows the count down to nothing', async () => {
    ask([retry, rounding]);
    mount();
    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(2));

    ask([]);

    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(undefined));
  });

  it('clears when the badge is switched off', async () => {
    ask([retry]);
    mount();
    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(1));

    act(() => useAwayAlertsStore.getState().setBadge({ isOn: false }));

    await waitFor(() => expect(tauri.setBadgeCount).toHaveBeenLastCalledWith(undefined));
  });

  it('is written by the main window only', async () => {
    tauri.label = 'win-harborline';
    ask([retry]);
    mount();
    await settle();

    expect(tauri.setBadgeCount).not.toHaveBeenCalled();
  });
});

describe('the banner on a transition into a blocking reason', () => {
  it('shows one banner naming the session, the reason and the workspace', async () => {
    mount();
    await settle();

    ask([retry]);

    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(1));
    expect(tauri.sendNotification).toHaveBeenCalledWith({
      title: 'Pick the retry window for notify-relay',
      body: '1 question for you',
      extra: { workspaceId: harborline.id, sessionId: retry.id, reason: 'open-question' },
    });
  });

  it('stays quiet for what already needed you when the window opened', async () => {
    ask([retry]);
    mount();
    await settle();

    expect(tauri.sendNotification).not.toHaveBeenCalled();
  });

  it('banners an agent error as well as a question', async () => {
    mount();
    await settle();

    act(() => {
      store.setState({
        sessions: SESSIONS.map((session) =>
          session.id === webhook.id ? { ...session, state: failedState() } : session,
        ),
      });
    });

    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(1));
    expect(tauri.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sign webhooks in payments-api',
        extra: expect.objectContaining({ reason: 'agent-error' }),
      }),
    );
  });

  it('fires once per session per reason while the reason stands', async () => {
    mount();
    await settle();
    ask([retry]);
    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(1));

    ask([retry, rounding]);
    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(2));
    ask([retry, rounding]);
    await settle();

    expect(tauri.sendNotification).toHaveBeenCalledTimes(2);
  });

  it('fires again when the same reason comes back after it cleared', async () => {
    mount();
    await settle();
    ask([retry]);
    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(1));

    ask([]);
    await settle();
    ask([retry]);

    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(2));
  });

  it('is quiet while any Goodboy window is focused', async () => {
    tauri.isFocused = true;
    mount();
    await settle();

    ask([retry]);
    await settle();

    expect(tauri.sendNotification).not.toHaveBeenCalled();
  });

  it('does not fire for the same session later when the window was in front at the time', async () => {
    tauri.isFocused = true;
    mount();
    await settle();
    ask([retry]);
    await settle();

    tauri.isFocused = false;
    ask([retry, rounding]);

    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(1));
    expect(tauri.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Round settlement totals in ledger-core' }),
    );
  });

  it('groups three arrivals into one banner for the workspace', async () => {
    mount();
    await settle();

    ask([retry, rounding, webhook]);

    await waitFor(() => expect(tauri.sendNotification).toHaveBeenCalledTimes(1));
    expect(tauri.sendNotification).toHaveBeenCalledWith({
      title: 'Harborline',
      body: '3 sessions need you',
      extra: { workspaceId: harborline.id, sessionId: null, reason: null },
    });
  });

  it('shows nothing when banners are off', async () => {
    useAwayAlertsStore.setState({ bannerChoice: 'off' });
    mount();
    await settle();

    ask([retry]);
    await settle();

    expect(tauri.sendNotification).not.toHaveBeenCalled();
  });

  it('turns banners off and says why when the system denies them', async () => {
    tauri.isPermissionGranted.mockResolvedValueOnce(false);
    tauri.requestPermission.mockResolvedValueOnce('denied');
    mount();
    await settle();

    ask([retry]);

    await waitFor(() => expect(useAwayAlertsStore.getState().bannerChoice).toBe('off'));
    expect(tauri.sendNotification).not.toHaveBeenCalled();
  });
});

describe('the one question about banners', () => {
  it('asks inline the first time something needs you while away, and sends no banner yet', async () => {
    useAwayAlertsStore.setState({ bannerChoice: 'unasked' });
    renderTree();
    await settle();

    ask([retry]);

    await screen.findByText('Banners while you are away');
    expect(tauri.sendNotification).not.toHaveBeenCalled();
    expect(useAwayAlertsStore.getState().bannerChoice).toBe('unasked');
  });

  it('turns banners on from the toast action', async () => {
    useAwayAlertsStore.setState({ bannerChoice: 'unasked' });
    renderTree();
    await settle();
    ask([retry]);
    const turnOn = await screen.findByRole('button', { name: 'Turn on' });

    act(() => turnOn.click());

    expect(useAwayAlertsStore.getState().bannerChoice).toBe('on');
  });

  it('turns banners off when the question is dismissed', async () => {
    useAwayAlertsStore.setState({ bannerChoice: 'unasked' });
    renderTree();
    await settle();
    ask([retry]);
    const dismiss = await screen.findByRole('button', { name: 'Dismiss notification' });

    act(() => dismiss.click());

    expect(useAwayAlertsStore.getState().bannerChoice).toBe('off');
  });
});

describe('a click on a banner', () => {
  const tapWith = (extra: Record<string, unknown>) => {
    const callback = tauri.onAction.mock.calls.at(-1)?.[0];
    act(() => callback?.({ actionId: 'tap', notification: { extra } }));
  };

  it('opens the session that asked, in the window of its workspace', async () => {
    mount();
    await waitFor(() => expect(tauri.onAction).toHaveBeenCalled());

    tapWith({ workspaceId: harborline.id, sessionId: retry.id, reason: 'open-question' });

    await waitFor(() => expect(store.getState().currentSessionId).toBe(retry.id));
  });

  it('ignores a banner of another workspace', async () => {
    mount();
    await waitFor(() => expect(tauri.onAction).toHaveBeenCalled());

    tapWith({ workspaceId: 'workspace-northwind', sessionId: retry.id, reason: 'open-question' });
    await settle();

    expect(store.getState().currentSessionId).toBeNull();
  });
});
