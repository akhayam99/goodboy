// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../../../store/storyHarness';
import { useIsWizardUp } from '.';

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

describe('useIsWizardUp', () => {
  it('is up until the wizard hands a draft over, then never again once the session started', () => {
    const { result } = renderHook(() => useIsWizardUp());
    expect(result.current).toBe(true);
    act(() => {
      store.setState({ openSessionDraftWorkspaceId: 'ws-1' });
    });
    expect(result.current).toBe(false);
    act(() => {
      store.setState({ openSessionDraftWorkspaceId: null });
    });
    expect(result.current).toBe(false);
  });
});
