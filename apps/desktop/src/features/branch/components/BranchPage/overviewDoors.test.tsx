// @vitest-environment happy-dom
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { installFakeResizeObserver } from '../../../../test/fakeResizeObserver';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { clearSceneInvoke, sceneInvoke } from '../../../../test/sceneInvoke';
import { ToastProvider } from '../../../../shared/components/Toast';
import type { Session } from '@goodboy/types';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
} from '../../../../app/components/MockScene/scenes/u26/centralColumnSeed';
import { branchPlace } from '../../../../store/slices/navigation/place';
import { startRunBranchOf } from '../../../session/startRun/startRunBranchOf';
import { startRunEventName } from '../../../session/startRun/startRunEventName';
import { BranchPage } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  installFakeResizeObserver();
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

type TabParams = {
  readonly tab: 'pr' | 'work';
};

const sessionOf = (): Session => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  return session;
};

const mount = async ({ tab }: TabParams): Promise<string | null> => {
  seedCentralColumn({ kind: 'branches' });
  const state = useAppStore.getState();
  const mountPath = (state.sessionProjectMounts[COLUMN_SESSION_ID] ?? [])[0]?.worktreePath ?? null;
  state.navigate({ to: branchPlace({ sessionId: COLUMN_SESSION_ID, mountPath, tab }) });
  render(
    <ToastProvider>
      <BranchPage session={sessionOf()} workingDir={null} />
    </ToastProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  await screen.findByRole('button', { name: 'Open a terminal here' });
  return mountPath;
};

describe('the branch page keeps what the Overview tile dropped', () => {
  it('opens a terminal in the branch folder from the header', async () => {
    const mountPath = await mount({ tab: 'pr' });

    fireEvent.click(screen.getByRole('button', { name: 'Open a terminal here' }));

    expect(useAppStore.getState().drawer?.kind).toBe('terminal');
    expect(useAppStore.getState().terminalScopes[COLUMN_SESSION_ID]).toBe(mountPath);
  });

  it('opens the browser from the header', async () => {
    await mount({ tab: 'pr' });

    fireEvent.click(screen.getByRole('button', { name: 'Open the browser here' }));

    expect(useAppStore.getState().drawer).toMatchObject({
      kind: 'browser',
      sessionId: COLUMN_SESSION_ID,
    });
  });

  it('starts a run on this branch from the header', async () => {
    await mount({ tab: 'pr' });
    const opened: Array<string | null> = [];
    const onOpen = (event: Event): void => {
      opened.push(startRunBranchOf({ event }));
    };
    const name = startRunEventName({ sessionId: COLUMN_SESSION_ID });
    window.addEventListener(name, onOpen);

    fireEvent.click(screen.getByRole('button', { name: 'Start a run on this branch' }));
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    window.removeEventListener(name, onOpen);

    const [first] = useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? [];
    expect(opened[0]).toBe(first?.branch);
  });

  it('holds Conversation, Changes and Runs, the tabs behind the facts of the tile', async () => {
    await mount({ tab: 'work' });

    const strip = screen.getByRole('tablist', { name: 'Branch pages' });
    const names = [...strip.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent ?? '');
    expect(names.some((text) => text.startsWith('Changes'))).toBe(true);
    expect(names.some((text) => text.startsWith('Runs'))).toBe(true);
    expect(names.some((text) => text.startsWith('Conversation'))).toBe(true);
  });
});
