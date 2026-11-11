// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../store/storyHarness';
import { AppOverlayRouter } from './index';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  storySpies.tauriInvoke.mockImplementation(() => new Promise<never>(() => undefined));
});

afterEach(() => {
  cleanup();
});

const HomeRouter = () => {
  const overlay = useAppStore((state) => state.appStudio);
  return (
    <AppOverlayRouter
      overlay={overlay}
      close={vi.fn()}
      onSettingsScopeChange={vi.fn()}
      onInboxFocusChange={vi.fn()}
      onImpactScopeChange={vi.fn()}
      onOpenChangelogScreen={vi.fn()}
      currentWorkspace={null}
      isWorkspaceLauncherBranch
      deleteOpen={false}
      deleteTargetSession={null}
      palette={null}
      closePalette={vi.fn()}
      closeDeleteConfirm={vi.fn()}
    />
  );
};

describe('AppOverlayRouter on Home', () => {
  it("keeps Help open when the Guide tab switches to What's new", async () => {
    useAppStore.getState().openStudio({ studio: { kind: 'guide' } });
    render(<HomeRouter />);

    const whatsNew = await screen.findByRole('tab', { name: "What's new" });
    fireEvent.click(whatsNew);

    expect(useAppStore.getState().appStudio).toEqual({ kind: 'changelog' });
    const selected = await screen.findByRole('tab', { name: "What's new" });
    expect(selected.getAttribute('aria-selected')).toBe('true');
  });
});
