// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { SettingsSearchResults } from './index';
import { settingsDirectory, type SettingsStatus } from '../settingsDirectory';

const STATUS: SettingsStatus = {
  subtitles: {
    updatesText: undefined,
    updatesTone: undefined,
    storageText: undefined,
    storageTone: undefined,
    securityFindingsText: undefined,
    securityFindingsTone: undefined,
    workspaceText: undefined,
    workspaceTone: undefined,
  },
};

const GROUPS = settingsDirectory({ status: STATUS, workspaceName: 'Harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(cleanup);

type MountParams = {
  readonly query: string;
};

const mount = ({ query }: MountParams) => {
  const onOpen = vi.fn();
  const onPicked = vi.fn();
  render(
    <SettingsSearchResults groups={GROUPS} query={query} onOpen={onOpen} onPicked={onPicked} />,
  );
  return { onOpen, onPicked };
};

describe('SettingsSearchResults', () => {
  it('lists the matching settings and opens the one picked', () => {
    const { onOpen, onPicked } = mount({ query: 'models' });

    const results = screen.getByRole('list', { name: 'Matching settings' });
    fireEvent.click(within(results).getByRole('button', { name: /Models/ }));

    expect(onPicked).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith({ scope: 'workspace', section: 'models' });
  });

  it.each(['Providers', 'integrations'])(
    'finds Go to Connections under the old name %s',
    (query) => {
      const { onOpen, onPicked } = mount({ query });

      const results = screen.getByRole('list', { name: 'Matching settings' });
      fireEvent.click(within(results).getByRole('button', { name: 'Go to Connections' }));

      expect(onPicked).toHaveBeenCalledOnce();
      expect(onOpen).not.toHaveBeenCalled();
      expect(useAppStore.getState().appStudio).toEqual({ kind: 'connections', focus: null });
    },
  );

  it('says so when nothing matches', () => {
    mount({ query: 'no such page' });

    screen.getByText('No settings match');
  });
});
