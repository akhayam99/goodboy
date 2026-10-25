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
import { cleanup, renderHook } from '@testing-library/react';
import { aWorkspace } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
} from '../../../../store/storyHarness';
import { brandedId } from '../../../history/testing/brandedId';
import { formatAdaptiveAge } from '../../../../shared/utils/time/formatAdaptiveAge';
import type { IsoDateTime } from '@goodboy/types';
import { useWorkspaceRowFacts } from '.';

beforeAll(async () => {
  await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T10:00:00.000Z'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useWorkspaceRowFacts', () => {
  it('draws no last seen for a workspace that was never opened', () => {
    const workspace = aWorkspace({ name: 'Harborline' });

    const { result } = renderHook(() => useWorkspaceRowFacts({ workspace }));

    expect(result.current.lastSeen).toBe('');
    expect(result.current.hasUnread).toBe(false);
  });

  it('says the last seen the one way the launcher and the switcher both read it', () => {
    const lastAccessedAt = brandedId<IsoDateTime>({ value: '2026-10-06T09:55:00.000Z' });
    const workspace = aWorkspace({ name: 'Harborline', lastAccessedAt });

    const { result } = renderHook(() => useWorkspaceRowFacts({ workspace }));

    expect(result.current.lastSeen).toBe(
      formatAdaptiveAge({ at: lastAccessedAt, now: Date.now() }),
    );
    expect(result.current.lastSeen).toBe('5m ago');
  });
});
