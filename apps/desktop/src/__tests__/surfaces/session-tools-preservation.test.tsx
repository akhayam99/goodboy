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
import { ToastProvider } from '../../shared/components/Toast';
import { KeepAliveWorkSurface } from '../../app/components/KeepAliveWorkSurface';
import { DrawerHost } from '../../app/components/DrawerHost';
import { openLens } from '../../features/session/openLens';
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
      <SessionTools sessionId={sessionId} isFolded={false} />
      <KeepAliveWorkSurface sessionId={sessionId} isActive />
      <DrawerHost />
    </ToastProvider>,
  );
  await settle();
};

const tools = (): HTMLElement => screen.getByRole('group', { name: 'Session tools' });

const press = async (name: RegExp | string): Promise<void> => {
  fireEvent.click(within(tools()).getByRole('button', { name }));
  await settle();
};

const paneToggles = (): ReadonlyArray<Element> =>
  [...document.querySelectorAll('[data-slot="pane-title-row"]')].flatMap((row) => [
    ...row.querySelectorAll('[data-testid^="pane-toggle-"]'),
  ]);

const drawerKind = (): string | null => useAppStore.getState().drawer?.kind ?? null;

describe('SPEC3 section 9 rows reachable from the session tools', () => {
  it('9.4 Ask beside any page: the tools stay the same on the Overview and on Agents', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mountSession({ sessionId });

    await press('Ask');
    expect(drawerKind()).toBe('ask');

    act(() => {
      useAppStore.getState().navigate({ to: sessionPlace({ sessionId, lens: 'agents' }) });
    });
    await settle();
    expect(within(tools()).getByRole('button', { name: 'Ask' })).toBeDefined();
    expect(paneToggles()).toEqual([]);
  });

  it('9.3 Context drawer from the old chip: the Context row opens it', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mountSession({ sessionId });

    await press(/^Context/);

    expect(useAppStore.getState().drawer).toMatchObject({ kind: 'context', sessionId });
  });

  it('9.8 session terminal: the Terminal toggle opens a shell on the worktree', async () => {
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

  it('9.8 Explore lens: the Explore toggle opens the files pane', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mountSession({ sessionId });

    await press('Explore');

    expect(drawerKind()).toBe('explore');
    expect(screen.getByRole('region', { name: 'Explore' })).toBeDefined();
  });

  it('9.8 Scripts lens: the Scripts row, the palette and the Open scripts toast reach the pane', async () => {
    const sessionId = seedSessionWithMounts({ useAppStore });
    await mountSession({ sessionId });

    await press(/^Scripts/);
    expect(drawerKind()).toBe('scripts');
    expect(screen.getByRole('region', { name: 'Scripts' })).toBeDefined();

    act(() => {
      useAppStore.getState().closeDrawer();
      openLens({ sessionId, lens: 'scripts' });
    });
    await settle();
    expect(drawerKind()).toBe('scripts');
  });
});
