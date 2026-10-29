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
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AUTO_SEED_SESSION, seedAutoSession } from '@goodboy/db/test-helpers/auto-seeds';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  openStorySqlite,
  resetStoryStore,
  storySqlite,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { readAutoLevel } from '../../../../../store/runtime/auto/level/readAutoLevel';
import { writeAutoLevel } from '../../../../../store/runtime/auto/level/writeAutoLevel';
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
  it('starts on After the plan and stores the workspace default that a run reads', async () => {
    render(<AutoLevelDefaultRow workspaceId={WORKSPACE_ID} />);

    screen.getByRole('tab', { name: 'After the plan', selected: true });
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));

    await waitFor(async () =>
      expect(
        await readAutoLevel({ db: storySqlite(), target: { workspaceId: WORKSPACE_ID } }),
      ).toBe('run'),
    );
    expect(
      await readAutoLevel({ db: storySqlite(), target: { sessionId: AUTO_SEED_SESSION } }),
    ).toBe('run');
    await screen.findByRole('tab', { name: 'Never', selected: true });
  });

  it('lets a level picked for a session win over the new default', async () => {
    await writeAutoLevel({
      db: storySqlite(),
      target: { sessionId: AUTO_SEED_SESSION },
      level: 'step',
    });
    render(<AutoLevelDefaultRow workspaceId={WORKSPACE_ID} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Never' }));

    await screen.findByRole('tab', { name: 'Never', selected: true });
    expect(
      await readAutoLevel({ db: storySqlite(), target: { sessionId: AUTO_SEED_SESSION } }),
    ).toBe('step');
    expect(useAppStore.getState().workspaceValues[WORKSPACE_ID]?.['auto.level']).toContain('run');
  });
});
