// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../store/storyHarness';
import type { StudioPlace } from '../../../store/slices/navigation/studio';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { useGoToBoard } from './index';

const workspace = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const session = aSession({ workspaceId: workspace.id, goal: 'Retry failed webhook deliveries' });

const SETTINGS: StudioPlace = {
  kind: 'settings',
  focus: { scope: 'app' },
};
const CHANGELOG: StudioPlace = { kind: 'changelog' };

type Place = {
  readonly name: string;
  readonly seed: () => void;
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    sessions: [session],
    currentSessionId: null,
    openSessionDraftWorkspaceId: null,
    appStudio: null,
  });
});

afterEach(cleanup);

const PLACES: ReadonlyArray<Place> = [
  {
    name: 'a session page',
    seed: () => useAppStore.setState({ currentSessionId: session.id }),
  },
  {
    name: 'a session page with a studio open over it',
    seed: () => useAppStore.setState({ currentSessionId: session.id, appStudio: CHANGELOG }),
  },
  {
    name: 'a session page with a lens open',
    seed: () =>
      useAppStore.setState({
        currentSessionId: session.id,
        activeLens: { [session.id]: 'branch' },
      }),
  },
  {
    name: 'the new session draft',
    seed: () => useAppStore.setState({ openSessionDraftWorkspaceId: workspace.id }),
  },
  {
    name: 'the new session draft with a studio open over it',
    seed: () =>
      useAppStore.setState({ openSessionDraftWorkspaceId: workspace.id, appStudio: SETTINGS }),
  },
];

const goToBoard = () => {
  const { result } = renderHook(() => useGoToBoard());
  act(() => result.current());
};

describe('useGoToBoard', () => {
  it.each(PLACES.map((place) => [place.name, place] as const))(
    'lands on the board from %s',
    (_name, place) => {
      place.seed();

      goToBoard();

      const state = useAppStore.getState();
      expect(state.currentSessionId).toBeNull();
      expect(state.openSessionDraftWorkspaceId).toBeNull();
      expect(state.appStudio).toBeNull();
    },
  );

  it('leaves a studio over the board and stays on the board', () => {
    useAppStore.setState({ appStudio: CHANGELOG });

    goToBoard();

    const state = useAppStore.getState();
    expect(state.appStudio).toBeNull();
    expect(state.currentSessionId).toBeNull();
    expect(state.openSessionDraftWorkspaceId).toBeNull();
  });

  it('lands on the board from a stack of two studios, not on the first studio', () => {
    act(() => useAppStore.getState().openStudio({ studio: CHANGELOG }));
    act(() => useAppStore.getState().openStudio({ studio: SETTINGS }));

    goToBoard();

    const state = useAppStore.getState();
    expect(state.appStudio).toBeNull();
    expect(state.currentSessionId).toBeNull();
  });

  it('replaces the studio entry, so Back from the board returns to the session', () => {
    act(() => useAppStore.getState().navigate({ to: sessionPlace({ sessionId: session.id }) }));
    act(() => useAppStore.getState().switchStudio({ studio: CHANGELOG }));
    expect(useAppStore.getState().appStudio).toEqual(CHANGELOG);

    goToBoard();
    expect(useAppStore.getState().currentSessionId).toBeNull();

    act(() => useAppStore.getState().back());
    const state = useAppStore.getState();
    expect(state.currentSessionId).toBe(session.id);
    expect(state.appStudio).toBeNull();
  });

  it('adds one history entry from the draft, and Back returns to the draft', () => {
    useAppStore.getState().navigate({ to: { at: 'session-draft' } });
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(workspace.id);

    goToBoard();
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBeNull();

    act(() => useAppStore.getState().back());
    expect(useAppStore.getState().openSessionDraftWorkspaceId).toBe(workspace.id);
  });

  it('does nothing when the board is already shown', () => {
    const navigate = vi.fn();
    const closeStudio = vi.fn();
    useAppStore.setState({ navigate, closeStudio });

    goToBoard();

    expect(navigate).not.toHaveBeenCalled();
    expect(closeStudio).not.toHaveBeenCalled();
  });

  it('ignores a draft left open for another workspace', () => {
    const navigate = vi.fn();
    useAppStore.setState({
      navigate,
      openSessionDraftWorkspaceId: 'workspace-northwind' as typeof workspace.id,
    });

    goToBoard();

    expect(navigate).not.toHaveBeenCalled();
  });
});
