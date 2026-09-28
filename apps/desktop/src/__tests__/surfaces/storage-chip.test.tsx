// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => undefined) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { ToastProvider } from '../../app/components/Toast';
import { StorageChip } from '../../app/components/AppTopBar/StorageChip';
import {
  SETTINGS_WORKSPACE,
  seedSettingsBase,
} from '../../app/components/MockScene/scenes/audit/settingsSeed';
import { SettingsStudio } from '../../features/settings/components/SettingsStudio';
import type { SettingsFocus } from '../../features/settings/components/SettingsStudio/types';
import type { StorageFolder } from '../../store/slices/storage/types';

const GB = 1024 ** 3;

let useAppStore: StoryStore;
let consoleErrors: Array<string> = [];

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  consoleErrors = [];
  vi.spyOn(console, 'error').mockImplementation((...args: ReadonlyArray<unknown>) => {
    consoleErrors.push(args.map(String).join(' '));
  });
  seedSettingsBase();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

const seedCanGo = (bytes: number): void => {
  const idle = useAppStore
    .getState()
    .storageFolders.find((folder: StorageFolder) => folder.origin === 'archived');
  if (idle === undefined) {
    throw new Error('seed has no archived folder');
  }
  useAppStore.setState({ storageFolders: [{ ...idle, sizeBytes: bytes }] });
};

const chip = () => screen.queryByRole('button', { name: /Goodboy can free/ });

describe('storage chip in the app header on the real store', () => {
  it('stays hidden while less than 1 GB can go', async () => {
    seedCanGo(0.9 * GB);
    render(<StorageChip />);
    await settle();

    expect(chip()).toBeNull();
  });

  it('shows from 1 GB with the rounded amount the storage page counts', async () => {
    seedCanGo(GB);
    const { unmount } = render(<StorageChip />);
    await settle();
    expect(chip()?.textContent).toBe('Free 1 GB');
    unmount();

    seedCanGo(7.2 * GB);
    render(<StorageChip />);
    await settle();
    expect(chip()?.textContent).toBe('Free 7 GB');
  });

  it('hides again once the folders are gone', async () => {
    seedCanGo(7.2 * GB);
    render(<StorageChip />);
    await settle();
    expect(chip()).not.toBeNull();

    act(() => useAppStore.setState({ storageFolders: [] }));

    expect(chip()).toBeNull();
  });

  it('opens storage on every workspace and lands on the worktree folders', async () => {
    seedCanGo(7.2 * GB);
    const opened: Array<SettingsFocus> = [];
    const onOpen = (event: Event) => opened.push((event as CustomEvent<SettingsFocus>).detail);
    window.addEventListener('goodboy:open-settings', onOpen);
    const scrollIntoView = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(() => undefined);

    render(<StorageChip />);
    await settle();
    fireEvent.click(chip()!);
    window.removeEventListener('goodboy:open-settings', onOpen);

    expect(opened).toEqual([{ scope: 'app', section: 'storage' }]);
    expect(useAppStore.getState().storageScope).toEqual({ kind: 'all' });
    expect(useAppStore.getState().storageFocus).toEqual({ filter: 'review' });

    cleanup();
    useAppStore.setState({ loadStorage: async () => undefined });
    render(
      <ToastProvider>
        <SettingsStudio
          currentWorkspace={SETTINGS_WORKSPACE}
          focus={opened[0]!}
          onScopeChange={() => undefined}
          onClose={() => undefined}
        />
      </ToastProvider>,
    );
    await settle();

    const space = screen.getByRole('region', { name: 'Free up space' });
    const headerRow = screen.getByRole('button', { name: /Check again/ }).parentElement!
      .parentElement!;
    expect(within(headerRow).getByLabelText('Storage scope')).toBeDefined();
    expect(within(space).queryByLabelText('Storage scope')).toBeNull();
    expect(within(space).getByText('7.2 GB can go')).toBeDefined();
    const scrolled = scrollIntoView.mock.contexts.map((element) => (element as HTMLElement).id);
    expect(scrolled).toContain('storage-worktrees');
    expect(useAppStore.getState().storageFocus).toBeNull();
    expect(consoleErrors.filter((line) => line.includes('Maximum update depth'))).toEqual([]);
  });
});
