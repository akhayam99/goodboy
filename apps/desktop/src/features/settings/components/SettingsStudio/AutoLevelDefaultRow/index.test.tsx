// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { AutoLevelDefaultRow } from './index';

const WORKSPACE_ID = brandId<WorkspaceId>({ value: 'workspace-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  await openStorySqlite();
  await seedAutoSession({ db: storySqlite() });
});

afterEach(cleanup);

describe('AutoLevelDefaultRow', () => {
  it.each([[undefined], ['false'], ['true']] as const)(
    'holds the permission rows and opens each permission from them, old Work switch row %s',
    (oldSwitch) => {
      useAppStore.setState({
        settings: oldSwitch === undefined ? {} : { 'work.enabled': oldSwitch },
      });
      render(<AutoLevelDefaultRow workspaceId={WORKSPACE_ID} />);

      screen.getByText('Auto agent asks you');
      expect(screen.queryByRole('tablist', { name: 'Auto agent asks you' })).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: /^Asks you: / }));

      screen.getByRole('dialog', { name: 'Asks you' });
    },
  );
});
