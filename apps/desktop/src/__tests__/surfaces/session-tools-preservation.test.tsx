// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));
vi.mock('../../shared/lib/db', () => ({
  tauriDatabase: {
    exec: async () => undefined,
    execute: async () => ({ rowsAffected: 0 }),
    select: async () => [],
  },
}));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { sessionPlace } from '../../store/slices/navigation/place';
import { selectIsContextTabOpen } from '../../store/slices/contextDrawer/selectIsContextTabOpen';
import { ToastProvider } from '../../shared/components/Toast';
import { KeepAliveWorkSurface } from '../../app/components/KeepAliveWorkSurface';
import { DrawerHost } from '../../app/components/DrawerHost';
import { openToolPane } from '../../features/session/panes/openToolPane';
import { SessionTools } from '../../features/session/components/SessionTools';
import { seedSessionWithMounts } from '../helpers/seedSessionWithMounts';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  cleanup();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

type MountParams = {
  readonly sessionId: SessionId;
};

const mountSession = async ({ sessionId }: MountParams): Promise<void> => {
  render(
    <ToastProvider>
      <SessionTools sessionId={sessionId} />
      <KeepAliveWorkSurface sessionId={sessionId} isActive />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
};

const tools = (): HTMLElement => screen.getByRole('toolbar', { name: 'Tools' });

const press = async (name: RegExp | string): Promise<void> => {
  fireEvent.click(within(tools()).getByRole('button', { name }));
  await settle();
};

const paneToggles = (): ReadonlyArray<Element> =>
  [...document.querySelectorAll('[data-slot="pane-title-row"]')].flatMap((row) => [
    ...row.querySelectorAll('[data-testid^="pane-toggle-"]'),
  ]);

const drawerKind = (): string | null => useAppStore.getState().drawer?.kind ?? null;

describe('session tools rows stay reachable', () => {
  it('Ask lives in the Context tab: ask.open lands there and the tools hold no Ask button', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mountSession({ sessionId });

    act(() => useAppStore.getState().openAsk({ sessionId }));
    await settle();
    expect(drawerKind()).toBeNull();
    expect(selectIsContextTabOpen({ state: useAppStore.getState(), sessionId })).toBe(true);

    act(() => {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId, lens: 'workflows' }) });
    });
    await settle();
    expect(within(tools()).queryByRole('button', { name: 'Ask this session' })).toBeNull();
    expect(paneToggles()).toEqual([]);
  });

  it('session terminal: the Terminal toggle opens a shell on the worktree', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    const mounts = (useAppStore.getState().sessionProjectMounts[sessionId] ?? []).map((mount) => ({
      ...mount,
      isAttached: true,
      diskState: 'present' as const,
    }));
    await mountSession({ sessionId });
    act(() => {
      useAppStore.setState((state) => ({
        sessionProjectMounts: { ...state.sessionProjectMounts, [sessionId]: mounts },
      }));
    });

    await press('Terminal');

    const { drawer, terminalTabs } = useAppStore.getState();
    const openId = drawer?.kind === 'terminal' ? drawer.payload.terminalId : null;
    const tab = (terminalTabs[sessionId] ?? []).find((candidate) => candidate.id === openId);
    expect(mounts.map((mount) => mount.worktreePath)).toContain(tab?.cwd);
  });

  it('the tools column holds Terminal and Browser only, no Explore, Agents or Scripts button', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mountSession({ sessionId });

    expect(
      within(tools())
        .getAllByRole('button')
        .map((button) => button.getAttribute('data-testid')),
    ).toEqual(['pane-toggle-terminal', 'pane-toggle-browser']);
    for (const name of ['Explore', 'Agents', /^Scripts/]) {
      expect(within(tools()).queryByRole('button', { name })).toBeNull();
    }
  });

  it('Scripts lens: the palette and the Open scripts toast still reach the pane', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mountSession({ sessionId });

    act(() => {
      openToolPane({ sessionId, pane: 'scripts' });
    });
    await settle();

    expect(drawerKind()).toBe('scripts');
    expect(screen.getByRole('region', { name: 'Scripts' })).toBeDefined();
  });
});
