// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../../../../store/storyHarness')).dbModuleMock({
    getWorkspaceValue: vi.fn(async () => null),
    insertWorkspaceValueIfAbsent: vi.fn(async () => true),
  }),
);
vi.mock('../../../../../shared/lib/db', async () =>
  (await import('../../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../store/storyHarness';
import { DefaultAutoLimitSetting } from './index';

let useAppStore: StoryStore;

const HARBORLINE = aWorkspace({ name: 'Harborline', slug: 'harborline' });

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({ workspaces: [HARBORLINE], currentWorkspaceId: HARBORLINE.id });
});

afterEach(cleanup);

describe('DefaultAutoLimitSetting', () => {
  it('reports a failed refresh apart from the write, which went through', async () => {
    const loadWorkspaceValue = vi
      .fn(async (): Promise<string | null> => null)
      .mockResolvedValueOnce(null)
      .mockRejectedValue(new Error('database is locked'));
    const reportError = vi.fn(async () => undefined);
    useAppStore.setState({ loadWorkspaceValue, reportError });
    render(<DefaultAutoLimitSetting workspaceId={HARBORLINE.id} workspaceName="Harborline" />);

    fireEvent.click(screen.getByRole('button', { name: /^Auto limit:/ }));
    const popover = screen.getByRole('dialog', { name: 'Auto limit' });
    fireEvent.change(within(popover).getByLabelText('Limit in dollars'), {
      target: { value: '12' },
    });
    await act(async () => {
      fireEvent.submit(within(popover).getByRole('form', { name: 'Limit for a new Auto' }));
    });

    expect(within(popover).queryByRole('alert')).toBeNull();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Saved the Auto limit, but couldn't refresh it",
        workspaceId: HARBORLINE.id,
      }),
    );
  });
});
