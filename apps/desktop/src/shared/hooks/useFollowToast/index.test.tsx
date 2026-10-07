// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AgentId, SessionId } from '@goodboy/types';
import { ToastProvider } from '../../components/Toast';
import {
  importStore,
  resetStoryStore,
  STORE_IMPORT_TIMEOUT_MS,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { seedSessionWithMounts } from '../../../__tests__/helpers/seedSessionWithMounts';
import { currentStack } from '../../../store/slices/navigation/currentStack';
import { locationKey } from '../../../store/slices/navigation/locationKey';
import { captureLocation } from '../../../store/slices/navigation/captureLocation';
import { BOARD_PLACE, agentPlace, sessionPlace } from '../../../store/slices/navigation/place';
import type { OpenDrawer } from '../../../store/slices/drawer/state';
import { isUserStart } from '../../lib/userStarts';
import { useFollowToast } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../store/storyHarness')).dbModuleMock({
    markAgentViewed: async () => undefined,
  }),
);

let useAppStore: StoryStore;
let sessionId: SessionId;
type FollowParams = Parameters<ReturnType<typeof useFollowToast>>[0];

let follow: ReturnType<typeof useFollowToast>;

const Caller = () => {
  follow = useFollowToast();
  return null;
};

const historyLength = (): number => currentStack(useAppStore.getState()).entries.length;

const currentKey = (): string =>
  locationKey({ place: captureLocation({ state: useAppStore.getState() }).place });

const mountToasts = () =>
  render(
    <ToastProvider>
      <Caller />
    </ToastProvider>,
  );

const showFollow = (params: FollowParams) => {
  act(() => follow(params));
};

const contextDrawer = (): OpenDrawer => ({
  kind: 'context',
  sessionId,
  payload: { tab: 'goal', view: 'current' },
});

let startCount = 0;

const nextStartKey = (): string => {
  startCount += 1;
  return `run-follow-${startCount}`;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ workspaces_with_unread: [] });
  sessionId = seedSessionWithMounts({ useAppStore });
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('useFollowToast', () => {
  it('offers Follow by default, as an info toast with the past-tense title', () => {
    mountToasts();

    showFollow({ title: 'Run started', target: { place: BOARD_PLACE } });

    expect(screen.getByText('Run started')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Follow' })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('announces the title through the toast status region', () => {
    mountToasts();

    showFollow({ title: 'Session started', target: { place: BOARD_PLACE } });

    expect(screen.getByRole('status').textContent).toContain('Session started');
  });

  it('shows the message only when the caller gives one', () => {
    mountToasts();

    showFollow({
      title: 'Plan approved',
      message: 'Implement started',
      target: { place: BOARD_PLACE },
    });

    expect(screen.getByText('Implement started')).toBeDefined();
  });

  it('takes a caller label for a target that is not the thing the title names', () => {
    mountToasts();

    showFollow({
      title: 'Plan approved',
      target: { place: BOARD_PLACE },
      label: 'Follow the run',
    });

    expect(screen.getByRole('button', { name: 'Follow the run' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });

  it('navigates as a push, so Back returns to where the user was', () => {
    mountToasts();
    const before = historyLength();
    const from = currentKey();

    showFollow({ title: 'Run started', target: { place: BOARD_PLACE } });
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(historyLength()).toBe(before + 1);
    expect(currentKey()).toBe('board');
    act(() => useAppStore.getState().back());
    expect(currentKey()).toBe(from);
  });

  it('lands on an agent request through its home page', () => {
    mountToasts();
    useAppStore.getState().navigate({ to: BOARD_PLACE });

    showFollow({
      title: 'Agent started',
      target: { place: agentPlace({ sessionId, agentId: 'agent-follow' as AgentId }) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(currentKey()).toBe(`s/${sessionId}/agents/agent/agent-follow`);
  });

  it('opens the drawer the target names', () => {
    mountToasts();
    expect(useAppStore.getState().drawer).toBeNull();

    showFollow({
      title: 'Plan approved',
      target: { place: sessionPlace({ sessionId }), drawer: contextDrawer() },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(useAppStore.getState().drawer).toEqual(contextDrawer());
  });

  it('runs the caller follow-up after the navigation', () => {
    mountToasts();
    const onFollow = vi.fn();

    showFollow({ title: 'Agent started', target: { place: BOARD_PLACE }, onFollow });
    expect(onFollow).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));

    expect(onFollow).toHaveBeenCalledOnce();
    expect(currentKey()).toBe('board');
  });

  it('keeps the title and drops the action when the target is on screen', () => {
    mountToasts();

    showFollow({ title: 'Run started', target: { place: sessionPlace({ sessionId }) } });

    expect(screen.getByText('Run started')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });

  it('keeps the action when an overlay drawer covers the target page', () => {
    mountToasts();
    const overlay = document.createElement('aside');
    overlay.setAttribute('data-drawer-mode', 'overlay');
    document.body.appendChild(overlay);

    showFollow({ title: 'Run started', target: { place: sessionPlace({ sessionId }) } });

    expect(screen.getByRole('button', { name: 'Follow' })).toBeDefined();
  });

  it('drops the action beside a push drawer, which leaves the page visible', () => {
    mountToasts();
    const push = document.createElement('aside');
    push.setAttribute('data-drawer-mode', 'push');
    document.body.appendChild(push);

    showFollow({ title: 'Run started', target: { place: sessionPlace({ sessionId }) } });

    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });

  it('drops the action when the target drawer is the one already open', () => {
    mountToasts();
    act(() =>
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId }), drawer: contextDrawer() }),
    );
    const overlay = document.createElement('aside');
    overlay.setAttribute('data-drawer-mode', 'overlay');
    document.body.appendChild(overlay);

    showFollow({
      title: 'Plan approved',
      target: { place: sessionPlace({ sessionId }), drawer: contextDrawer() },
    });

    expect(screen.queryByRole('button', { name: 'Follow' })).toBeNull();
  });

  it('keeps the action when the page matches but another drawer is open', () => {
    mountToasts();
    act(() =>
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId }), drawer: contextDrawer() }),
    );

    showFollow({
      title: 'Plan approved',
      target: {
        place: sessionPlace({ sessionId }),
        drawer: { kind: 'ask', sessionId, payload: null },
      },
    });

    expect(screen.getByRole('button', { name: 'Follow' })).toBeDefined();
  });

  it('keeps the action while a studio covers the page', () => {
    mountToasts();
    act(() => useAppStore.getState().openStudio({ studio: { kind: 'notifications' } }));

    showFollow({ title: 'Run started', target: { place: sessionPlace({ sessionId }) } });

    expect(screen.getByRole('button', { name: 'Follow' })).toBeDefined();
  });

  it('shows one toast for two calls with the same start key', () => {
    mountToasts();
    const startKey = nextStartKey();

    showFollow({ title: 'Plan approved', target: { place: BOARD_PLACE }, startKey });
    showFollow({ title: 'Plan approved', target: { place: BOARD_PLACE }, startKey });

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Follow' })).toHaveLength(1);
    expect(screen.getByText('×2')).toBeDefined();
  });

  it('shows a toast per start when the keys differ', () => {
    mountToasts();

    showFollow({
      title: 'Agent started',
      target: { place: BOARD_PLACE },
      startKey: nextStartKey(),
    });
    showFollow({
      title: 'Agent started',
      target: { place: BOARD_PLACE },
      startKey: nextStartKey(),
    });

    expect(screen.getAllByRole('status')).toHaveLength(2);
  });

  it('marks the start key as a user start', () => {
    mountToasts();
    const startKey = nextStartKey();
    expect(isUserStart(startKey)).toBe(false);

    showFollow({ title: 'Run started', target: { place: BOARD_PLACE }, startKey });

    expect(isUserStart(startKey)).toBe(true);
  });
});
