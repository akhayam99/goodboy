// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { brandId, type WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { BoardFactsNotice } from './BoardFactsNotice';

const HARBORLINE = brandId<WorkspaceId>({ value: 'workspace-harborline' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  act(() => {
    useAppStore.setState({
      currentWorkspaceId: HARBORLINE,
      sessions: [],
      workspaceFactsError: 'database is locked',
    });
  });
});

afterEach(cleanup);

describe('BoardFactsNotice', () => {
  it('says the board could not read what needs you, and Retry reads it again', async () => {
    render(<BoardFactsNotice workspaceId={HARBORLINE} error="database is locked" />);

    screen.getByText("Couldn't read what needs you");
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(useAppStore.getState().workspaceFactsError).toBeNull());
  });
});
