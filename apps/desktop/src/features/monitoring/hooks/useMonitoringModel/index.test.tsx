// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { WorkspaceId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import type { MonitoringTarget } from '../../monitoringTarget';
import { useMonitoringModel } from './index';

const TARGET: MonitoringTarget = {
  workspaceId: 'w-harborline',
  projectId: 'payments-api',
  branch: 'hl/fix-duplicate-credit',
};

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    currentWorkspaceId: 'w-harborline' as WorkspaceId,
    monitorPinned: [
      { port: 5005, description: 'ledger-core' },
      { port: 5006, description: 'notify-relay' },
    ],
  });
});

afterEach(cleanup);

describe('useMonitoringModel summary', () => {
  it('counts every tracked port on the all-ports page', () => {
    useAppStore.setState({ appStudio: { kind: 'monitoring', target: null } });

    const { result } = renderHook(() => useMonitoringModel());

    expect(result.current.summary).toEqual({ inUse: 0, total: 2 });
  });

  it('counts only the ports on the branch page, not the tracked ones elsewhere', () => {
    useAppStore.setState({ appStudio: { kind: 'monitoring', target: TARGET } });

    const { result } = renderHook(() => useMonitoringModel());

    expect(result.current.pinned).toEqual([]);
    expect(result.current.summary).toEqual({ inUse: 0, total: 0 });
  });
});
