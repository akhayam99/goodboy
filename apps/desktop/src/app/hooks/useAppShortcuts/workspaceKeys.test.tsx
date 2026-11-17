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
import { cleanup, render } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { pressShortcut } from '../../../__tests__/helpers/pressKey';
import { useAppShortcuts } from './index';

const harborline = aWorkspace({ name: 'Harborline', slug: 'harborline' });
const northwind = aWorkspace({ name: 'Northwind', slug: 'northwind' });

let useAppStore: StoryStore;

const Harness = () => {
  useAppShortcuts({
    armDeleteConfirm: () => undefined,
    openPalette: () => undefined,
    openSettings: () => undefined,
    openNewChat: () => undefined,
    openShortcutHelp: () => undefined,
    toggleSidebar: () => undefined,
  });
  return null;
};

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
  useAppStore.setState({
    workspaces: [harborline, northwind],
    currentWorkspaceId: harborline.id,
  });
});

afterEach(cleanup);

describe('the workspace chords', () => {
  it('opens the switcher with the workspace chord, for the mark at the top of the rail to hear', () => {
    const heard = vi.fn();
    window.addEventListener('goodboy:open-workspace-switcher', heard);
    render(<Harness />);

    pressShortcut({ id: 'workspace.switcher' });

    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener('goodboy:open-workspace-switcher', heard);
  });

  it('switches to the first other workspace on the first digit, and leaves the current one until the store says so', async () => {
    const openWorkspace = vi.fn(async () => ({ kind: 'opened' as const }));
    useAppStore.setState({ openWorkspace });
    render(<Harness />);

    pressShortcut({ id: 'workspace.1' });

    await vi.waitFor(() => expect(openWorkspace).toHaveBeenCalledTimes(1));
    expect(openWorkspace).toHaveBeenCalledWith({
      id: northwind.id,
      title: 'Northwind',
      onRunning: 'new-window',
    });
    expect(useAppStore.getState().currentWorkspaceId).toBe(harborline.id);
  });

  it('leaves a digit with no workspace behind it alone', () => {
    const openWorkspace = vi.fn(async () => ({ kind: 'opened' as const }));
    useAppStore.setState({ openWorkspace });
    render(<Harness />);

    pressShortcut({ id: 'workspace.2' });

    expect(openWorkspace).not.toHaveBeenCalled();
  });
});
